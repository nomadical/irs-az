import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { findWork, getDb, newStatus, statusUpdate } from './db';
import { renderMarkdown } from '../utils/markdown';
import type { TranslationFrontmatter } from '../types';

const TRANSLATIONS_DIR = path.resolve(__dirname, '../../data/translations');

interface TranslationMd {
  frontmatter: TranslationFrontmatter;
  body: string;
  filePath: string;
}

function loadTranslationFiles(): TranslationMd[] {
  if (!fs.existsSync(TRANSLATIONS_DIR)) return [];

  return fs
    .readdirSync(TRANSLATIONS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const filePath = path.join(TRANSLATIONS_DIR, f);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(raw);
      return {
        frontmatter: data as TranslationFrontmatter,
        body: content.trim(),
        filePath,
      };
    });
}

export async function importTranslations(opts: {
  dryRun?: boolean;
  authorSlug?: string;
  publish?: boolean;
  translator?: string;
}) {
  const db = getDb();
  const files = loadTranslationFiles().filter((f) => !opts.translator || f.frontmatter.translator === opts.translator);

  // If filtering by author, we need to resolve which work slugs belong to that author
  let allowedWorkSlugs: Set<string> | null = null;
  if (opts.authorSlug) {
    const author = await db.author.findUnique({ where: { slug: opts.authorSlug } });
    if (author) {
      const works = await db.work.findMany({
        where: { authorId: author.id },
        select: { slug: true },
      });
      allowedWorkSlugs = new Set(works.map((w) => w.slug));
    }
  }

  const filtered = allowedWorkSlugs
    ? files.filter((f) => allowedWorkSlugs!.has(f.frontmatter.workSlug))
    : files;

  console.log(`Importing ${filtered.length} translation(s)...`);

  for (const { frontmatter: fm, body } of filtered) {
    // Resolve work
    const work = await findWork(fm.workSlug);
    if (!work) {
      console.warn(`  Skipping translation: work "${fm.workSlug}" not found`);
      continue;
    }

    const bodyHtml = body ? renderMarkdown(body) : null;

    if (opts.dryRun) {
      console.log(
        `  [DRY RUN] Would upsert translation: ${fm.workSlug} / ${fm.language} / ${fm.type}`,
      );
      continue;
    }

    const data = {
      scriptDirection: fm.scriptDirection ?? 'LTR',
      body,
      bodyHtml,
      translator: fm.translator ?? null,
      translatorNote: fm.translatorNote ?? null,
      year: fm.year ?? null,
      sourceNote: fm.sourceNote ?? null,
      isDefault: fm.isDefault ?? false,
    };

    // A work can have several translations per language; the translator tells them apart
    const existing = await db.translation.findFirst({
      where: { workId: work.id, language: fm.language, type: fm.type, translator: fm.translator ?? null },
    });
    if (existing) {
      await db.translation.update({ where: { id: existing.id }, data: { ...data, ...statusUpdate(opts, fm.hold) } });
    } else {
      await db.translation.create({
        data: { ...data, workId: work.id, language: fm.language, type: fm.type, status: newStatus(opts, fm.status, fm.hold) },
      });
    }

    console.log(`  Upserted translation: ${fm.workSlug} / ${fm.language} / ${fm.type}`);
  }
}
