import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { findWork, getDb } from './db';
import { renderMarkdown } from '../utils/markdown';
import type { WorkFrontmatter } from '../types';

const WORKS_DIR = path.resolve(__dirname, '../../data/works');

interface WorkMd {
  frontmatter: WorkFrontmatter;
  body: string;
  filePath: string;
}

function loadWorkFiles(): WorkMd[] {
  if (!fs.existsSync(WORKS_DIR)) return [];
  const results: WorkMd[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) {
        const raw = fs.readFileSync(full, 'utf-8');
        const { data, content } = matter(raw);
        results.push({
          frontmatter: data as WorkFrontmatter,
          body: content.trim(),
          filePath: full,
        });
      }
    }
  }

  walk(WORKS_DIR);
  return results;
}

export async function importWorks(opts: {
  dryRun?: boolean;
  authorSlug?: string;
  publish?: boolean;
}) {
  const db = getDb();
  const files = loadWorkFiles();
  const filtered = opts.authorSlug
    ? files.filter((f) => f.frontmatter.authorSlug === opts.authorSlug)
    : files;

  console.log(`Importing ${filtered.length} work(s)...`);

  for (const { frontmatter: fm, body } of filtered) {
    // Resolve author
    const author = await db.author.findUnique({ where: { slug: fm.authorSlug } });
    if (!author) {
      console.warn(`  Skipping work ${fm.slug}: author "${fm.authorSlug}" not found`);
      continue;
    }

    // Resolve collection (optional)
    let collectionId: string | null = null;
    if (fm.collectionSlug) {
      const collection = await db.collection.findUnique({
        where: { slug: fm.collectionSlug },
      });
      if (collection) {
        collectionId = collection.id;
      } else {
        console.warn(`  Warning: collection "${fm.collectionSlug}" not found for work ${fm.slug}`);
      }
    }

    const bodyHtml = body ? renderMarkdown(body) : null;

    if (opts.dryRun) {
      console.log(`  [DRY RUN] Would upsert work: ${fm.slug} (author: ${fm.authorSlug})`);
      continue;
    }

    const data = {
      titleAz: fm.titleAz,
      titleRu: fm.titleRu ?? null,
      titleFa: fm.titleFa ?? null,
      titleEn: fm.titleEn ?? null,
      body,
      bodyHtml,
      originalLang: fm.originalLang,
      scriptDirection: fm.scriptDirection ?? 'LTR',
      genre: fm.genre ?? 'POEM',
      form: fm.form ?? null,
      year: fm.year ?? null,
      yearApprox: fm.yearApprox ?? false,
      order: fm.order ?? null,
      authorId: author.id,
      collectionId,
      sourceNote: fm.sourceNote ?? null,
      sourceId: fm.sourceId ?? null,
      status: opts.publish ? ('PUBLISHED' as const) : (fm.status ?? 'DRAFT'),
    };

    // Match on the stable import key first, so a renamed slug updates the same row
    const existing =
      (fm.sourceId && (await findWork(fm.sourceId))) || (await findWork(fm.slug));

    if (existing) {
      const renamed = existing.slug !== fm.slug;
      await db.work.update({
        where: { id: existing.id },
        data: {
          ...data,
          slug: fm.slug,
          ...(renamed && { previousSlugs: { push: existing.slug } }),
        },
      });
    } else {
      await db.work.create({ data: { ...data, slug: fm.slug } });
    }

    console.log(`  Upserted work: ${fm.slug}`);
  }
}
