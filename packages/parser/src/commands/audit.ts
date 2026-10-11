import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import {
  LANGUAGES,
  GENRES,
  POEM_FORMS,
  AUTHOR_TYPES,
  TRANSLATION_TYPES,
  PUBLISH_STATUSES,
  SCRIPT_DIRECTIONS,
} from '../types';

const DATA_DIR = path.resolve(__dirname, '../../data');

interface AuditResult {
  errors: string[];
  warnings: string[];
}

function globMd(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];

  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) results.push(full);
    }
  }

  walk(dir);
  return results;
}

function relPath(filePath: string): string {
  return path.relative(DATA_DIR, filePath);
}

function validateEnum(value: unknown, allowed: readonly string[], fieldName: string): string | null {
  if (value == null) return null; // optional
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return null;
  return `invalid ${fieldName}: "${value}" (expected one of: ${allowed.join(', ')})`;
}

function validateEnumArray(value: unknown, allowed: readonly string[], fieldName: string): string | null {
  if (!Array.isArray(value)) return `${fieldName} must be an array`;
  for (const v of value) {
    const err = validateEnum(v, allowed, fieldName);
    if (err) return err;
  }
  return null;
}

function required(fm: Record<string, unknown>, field: string): string | null {
  if (fm[field] == null || fm[field] === '') return `missing required field: ${field}`;
  return null;
}

function auditAuthors(result: AuditResult) {
  const files = globMd(path.join(DATA_DIR, 'authors'));
  const slugs = new Set<string>();

  for (const file of files) {
    const rel = relPath(file);
    const raw = fs.readFileSync(file, 'utf-8');
    const { data: fm, content } = matter(raw);

    // Required fields
    for (const field of ['slug', 'nameAz', 'type', 'status']) {
      const err = required(fm, field);
      if (err) result.errors.push(`${rel}: ${err}`);
    }

    // Enum validation
    const enumErr = validateEnum(fm.type, AUTHOR_TYPES, 'type');
    if (enumErr) result.errors.push(`${rel}: ${enumErr}`);

    const statusErr = validateEnum(fm.status, PUBLISH_STATUSES, 'status');
    if (statusErr) result.errors.push(`${rel}: ${statusErr}`);

    if (fm.writingLangs) {
      const langsErr = validateEnumArray(fm.writingLangs, LANGUAGES, 'writingLangs');
      if (langsErr) result.errors.push(`${rel}: ${langsErr}`);
    }

    // Duplicate slug check
    if (fm.slug) {
      if (slugs.has(fm.slug)) result.errors.push(`${rel}: duplicate author slug "${fm.slug}"`);
      slugs.add(fm.slug);
    }

    // Warnings
    if (!content.trim()) result.warnings.push(`${rel}: empty body (no bio)`);
    if (!fm.bornYear) result.warnings.push(`${rel}: missing bornYear`);
  }
}

function auditCollections(result: AuditResult, authorSlugs: Set<string>) {
  const files = globMd(path.join(DATA_DIR, 'collections'));
  const slugs = new Set<string>();

  for (const file of files) {
    const rel = relPath(file);
    const { data: fm } = matter(fs.readFileSync(file, 'utf-8'));

    for (const field of ['slug', 'titleAz', 'authorSlug', 'genre', 'originalLang', 'status']) {
      const err = required(fm, field);
      if (err) result.errors.push(`${rel}: ${err}`);
    }

    const genreErr = validateEnum(fm.genre, GENRES, 'genre');
    if (genreErr) result.errors.push(`${rel}: ${genreErr}`);

    const langErr = validateEnum(fm.originalLang, LANGUAGES, 'originalLang');
    if (langErr) result.errors.push(`${rel}: ${langErr}`);

    if (fm.authorSlug && !authorSlugs.has(fm.authorSlug)) {
      result.errors.push(`${rel}: authorSlug "${fm.authorSlug}" not found in authors/`);
    }

    if (fm.slug) {
      if (slugs.has(fm.slug)) result.errors.push(`${rel}: duplicate collection slug "${fm.slug}"`);
      slugs.add(fm.slug);
    }
  }

  return slugs;
}

function auditWorks(
  result: AuditResult,
  authorSlugs: Set<string>,
  collectionSlugs: Set<string>,
) {
  const files = globMd(path.join(DATA_DIR, 'works'));
  const slugs = new Set<string>();

  for (const file of files) {
    const rel = relPath(file);
    const { data: fm, content } = matter(fs.readFileSync(file, 'utf-8'));

    for (const field of ['slug', 'titleAz', 'authorSlug', 'originalLang', 'genre', 'status']) {
      const err = required(fm, field);
      if (err) result.errors.push(`${rel}: ${err}`);
    }

    const genreErr = validateEnum(fm.genre, GENRES, 'genre');
    if (genreErr) result.errors.push(`${rel}: ${genreErr}`);

    if (fm.form) {
      const formErr = validateEnum(fm.form, POEM_FORMS, 'form');
      if (formErr) result.errors.push(`${rel}: ${formErr}`);
    }

    const langErr = validateEnum(fm.originalLang, LANGUAGES, 'originalLang');
    if (langErr) result.errors.push(`${rel}: ${langErr}`);

    const dirErr = validateEnum(fm.scriptDirection, SCRIPT_DIRECTIONS, 'scriptDirection');
    if (dirErr) result.errors.push(`${rel}: ${dirErr}`);

    if (fm.authorSlug && !authorSlugs.has(fm.authorSlug)) {
      result.errors.push(`${rel}: authorSlug "${fm.authorSlug}" not found`);
    }

    if (fm.collectionSlug && !collectionSlugs.has(fm.collectionSlug)) {
      result.warnings.push(`${rel}: collectionSlug "${fm.collectionSlug}" not found in collections/`);
    }

    if (!content.trim()) result.errors.push(`${rel}: empty body`);

    if (fm.slug) {
      if (slugs.has(fm.slug)) result.errors.push(`${rel}: duplicate work slug "${fm.slug}"`);
      slugs.add(fm.slug);
    }
  }

  return slugs;
}

function auditTranslations(result: AuditResult, workSlugs: Set<string>) {
  const files = globMd(path.join(DATA_DIR, 'translations'));
  const seen = new Set<string>();

  for (const file of files) {
    const rel = relPath(file);
    const { data: fm, content } = matter(fs.readFileSync(file, 'utf-8'));

    for (const field of ['workSlug', 'language', 'type', 'status']) {
      const err = required(fm, field);
      if (err) result.errors.push(`${rel}: ${err}`);
    }

    const langErr = validateEnum(fm.language, LANGUAGES, 'language');
    if (langErr) result.errors.push(`${rel}: ${langErr}`);

    const typeErr = validateEnum(fm.type, TRANSLATION_TYPES, 'type');
    if (typeErr) result.errors.push(`${rel}: ${typeErr}`);

    const dirErr = validateEnum(fm.scriptDirection, SCRIPT_DIRECTIONS, 'scriptDirection');
    if (dirErr) result.errors.push(`${rel}: ${dirErr}`);

    if (fm.workSlug && !workSlugs.has(fm.workSlug)) {
      result.warnings.push(`${rel}: workSlug "${fm.workSlug}" not found in works/`);
    }

    // Check for duplicate translations (same work + language + type)
    if (fm.workSlug && fm.language && fm.type) {
      const key = `${fm.workSlug}:${fm.language}:${fm.type}`;
      if (seen.has(key)) result.errors.push(`${rel}: duplicate translation ${key}`);
      seen.add(key);
    }

    if (!content.trim()) result.errors.push(`${rel}: empty body`);
  }
}

export const auditCommand = new Command('audit')
  .description('Validate all .md files in data/')
  .action(() => {
    console.log('Auditing markdown files...\n');

    const result: AuditResult = { errors: [], warnings: [] };

    // Collect author slugs first
    const authorFiles = globMd(path.join(DATA_DIR, 'authors'));
    const authorSlugs = new Set<string>();
    for (const f of authorFiles) {
      const { data } = matter(fs.readFileSync(f, 'utf-8'));
      if (data.slug) authorSlugs.add(data.slug);
    }

    auditAuthors(result);
    const collectionSlugs = auditCollections(result, authorSlugs);
    const workSlugs = auditWorks(result, authorSlugs, collectionSlugs);
    auditTranslations(result, workSlugs);

    // Report
    if (result.warnings.length > 0) {
      console.log(`Warnings (${result.warnings.length}):`);
      for (const w of result.warnings) console.log(`  ⚠ ${w}`);
      console.log();
    }

    if (result.errors.length > 0) {
      console.log(`Errors (${result.errors.length}):`);
      for (const e of result.errors) console.log(`  ✗ ${e}`);
      console.log();
      process.exit(1);
    }

    const totalFiles =
      globMd(path.join(DATA_DIR, 'authors')).length +
      globMd(path.join(DATA_DIR, 'collections')).length +
      globMd(path.join(DATA_DIR, 'works')).length +
      globMd(path.join(DATA_DIR, 'translations')).length;

    console.log(`Audit passed. ${totalFiles} files checked, ${result.warnings.length} warnings.`);
  });
