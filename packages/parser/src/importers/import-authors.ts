import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { getDb } from './db';
import { renderMarkdown } from '../utils/markdown';
import type { AuthorFrontmatter } from '../types';

const AUTHORS_DIR = path.resolve(__dirname, '../../data/authors');

interface AuthorMd {
  frontmatter: AuthorFrontmatter & { bioRu?: string };
  bioAz: string;
  filePath: string;
}

function loadAuthorFiles(): AuthorMd[] {
  if (!fs.existsSync(AUTHORS_DIR)) return [];

  return fs
    .readdirSync(AUTHORS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const filePath = path.join(AUTHORS_DIR, f);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(raw);
      return {
        frontmatter: data as AuthorMd['frontmatter'],
        bioAz: content.trim(),
        filePath,
      };
    });
}

export async function importAuthors(opts: {
  dryRun?: boolean;
  force?: boolean;
  authorSlug?: string;
  publish?: boolean;
}) {
  const db = getDb();
  const files = loadAuthorFiles();
  const filtered = opts.authorSlug
    ? files.filter((f) => f.frontmatter.slug === opts.authorSlug)
    : files;

  console.log(`Importing ${filtered.length} author(s)...`);

  for (const { frontmatter: fm, bioAz } of filtered) {
    const bioAzHtml = bioAz ? renderMarkdown(bioAz) : null;
    const bioRuHtml = fm.bioRu ? renderMarkdown(fm.bioRu) : null;

    if (opts.dryRun) {
      console.log(`  [DRY RUN] Would upsert author: ${fm.slug} (${fm.nameAz})`);
      continue;
    }

    await db.author.upsert({
      where: { slug: fm.slug },
      create: {
        slug: fm.slug,
        nameAz: fm.nameAz,
        nameRu: fm.nameRu ?? null,
        nameFa: fm.nameFa ?? null,
        nameEn: fm.nameEn ?? null,
        bornYear: fm.bornYear ?? null,
        bornYearApprox: fm.bornYearApprox ?? false,
        diedYear: fm.diedYear ?? null,
        diedYearApprox: fm.diedYearApprox ?? false,
        bornPlace: fm.bornPlace ?? null,
        diedPlace: fm.diedPlace ?? null,
        type: fm.type,
        period: fm.period ?? null,
        writingLangs: fm.writingLangs ?? [],
        bioAz: bioAz || null,
        bioRu: fm.bioRu ?? null,
        status: opts.publish ? 'PUBLISHED' : (fm.status ?? 'DRAFT'),
      },
      update: {
        nameAz: fm.nameAz,
        nameRu: fm.nameRu ?? null,
        nameFa: fm.nameFa ?? null,
        nameEn: fm.nameEn ?? null,
        bornYear: fm.bornYear ?? null,
        bornYearApprox: fm.bornYearApprox ?? false,
        diedYear: fm.diedYear ?? null,
        diedYearApprox: fm.diedYearApprox ?? false,
        bornPlace: fm.bornPlace ?? null,
        diedPlace: fm.diedPlace ?? null,
        type: fm.type,
        period: fm.period ?? null,
        writingLangs: fm.writingLangs ?? [],
        bioAz: bioAz || null,
        bioRu: fm.bioRu ?? null,
        status: opts.publish ? 'PUBLISHED' : (fm.status ?? 'DRAFT'),
      },
    });

    console.log(`  Upserted author: ${fm.slug}`);
  }
}
