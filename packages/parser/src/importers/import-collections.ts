import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { getDb } from './db';
import type { CollectionFrontmatter } from '../types';

const COLLECTIONS_DIR = path.resolve(__dirname, '../../data/collections');

interface CollectionMd {
  frontmatter: CollectionFrontmatter;
  description: string;
  filePath: string;
}

function loadCollectionFiles(): CollectionMd[] {
  if (!fs.existsSync(COLLECTIONS_DIR)) return [];
  const results: CollectionMd[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) {
        const raw = fs.readFileSync(full, 'utf-8');
        const { data, content } = matter(raw);
        results.push({
          frontmatter: data as CollectionFrontmatter,
          description: content.trim(),
          filePath: full,
        });
      }
    }
  }

  walk(COLLECTIONS_DIR);
  return results;
}

export async function importCollections(opts: {
  dryRun?: boolean;
  authorSlug?: string;
  publish?: boolean;
}) {
  const db = getDb();
  const files = loadCollectionFiles();
  const filtered = opts.authorSlug
    ? files.filter((f) => f.frontmatter.authorSlug === opts.authorSlug)
    : files;

  console.log(`Importing ${filtered.length} collection(s)...`);

  for (const { frontmatter: fm, description } of filtered) {
    // Resolve author
    const author = await db.author.findUnique({ where: { slug: fm.authorSlug } });
    if (!author) {
      console.warn(`  Skipping collection ${fm.slug}: author "${fm.authorSlug}" not found in DB`);
      continue;
    }

    if (opts.dryRun) {
      console.log(`  [DRY RUN] Would upsert collection: ${fm.slug} (author: ${fm.authorSlug})`);
      continue;
    }

    await db.collection.upsert({
      where: { slug: fm.slug },
      create: {
        slug: fm.slug,
        titleAz: fm.titleAz,
        titleRu: fm.titleRu ?? null,
        titleFa: fm.titleFa ?? null,
        titleEn: fm.titleEn ?? null,
        authorId: author.id,
        year: fm.year ?? null,
        yearApprox: fm.yearApprox ?? false,
        originalLang: fm.originalLang ?? 'AZ_LATIN',
        genre: fm.genre ?? 'POEM',
        descriptionAz: description || null,
        order: fm.order ?? null,
        status: opts.publish ? 'PUBLISHED' : (fm.status ?? 'DRAFT'),
      },
      update: {
        titleAz: fm.titleAz,
        titleRu: fm.titleRu ?? null,
        titleFa: fm.titleFa ?? null,
        titleEn: fm.titleEn ?? null,
        authorId: author.id,
        year: fm.year ?? null,
        yearApprox: fm.yearApprox ?? false,
        originalLang: fm.originalLang ?? 'AZ_LATIN',
        genre: fm.genre ?? 'POEM',
        descriptionAz: description || null,
        order: fm.order ?? null,
        status: opts.publish ? 'PUBLISHED' : (fm.status ?? 'DRAFT'),
      },
    });

    console.log(`  Upserted collection: ${fm.slug}`);
  }
}
