import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { findWork, getDb, newStatus, statusUpdate } from './db';
import type { ArtworkFrontmatter } from '../types';

const ARTWORKS_DIR = path.resolve(__dirname, '../../data/artworks');

function loadArtworkFiles(): ArtworkFrontmatter[] {
  if (!fs.existsSync(ARTWORKS_DIR)) return [];
  const results: ArtworkFrontmatter[] = [];
  for (const author of fs.readdirSync(ARTWORKS_DIR, { withFileTypes: true })) {
    if (!author.isDirectory()) continue;
    const dir = path.join(ARTWORKS_DIR, author.name);
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      results.push(matter(fs.readFileSync(path.join(dir, f), 'utf-8')).data as ArtworkFrontmatter);
    }
  }
  return results;
}

export async function importArtworks(opts: {
  dryRun?: boolean;
  authorSlug?: string;
  publish?: boolean;
}) {
  const db = getDb();
  const files = loadArtworkFiles().filter((a) => !opts.authorSlug || a.authorSlug === opts.authorSlug);
  console.log(`Importing ${files.length} artwork(s)...`);

  const authorIds = new Map<string, string | null>();
  const collectionIds = new Map<string, string | null>();

  for (const fm of files) {
    if (!authorIds.has(fm.authorSlug)) {
      const author = await db.author.findUnique({ where: { slug: fm.authorSlug } });
      authorIds.set(fm.authorSlug, author?.id ?? null);
    }
    const authorId = authorIds.get(fm.authorSlug);
    if (!authorId) {
      console.warn(`  Skipping artwork ${fm.sourceId}: author "${fm.authorSlug}" not found`);
      continue;
    }

    let collectionId: string | null = null;
    if (fm.collectionSlug) {
      if (!collectionIds.has(fm.collectionSlug)) {
        const collection = await db.collection.findUnique({ where: { slug: fm.collectionSlug } });
        if (!collection) console.warn(`  Warning: collection "${fm.collectionSlug}" not found for ${fm.sourceId}`);
        collectionIds.set(fm.collectionSlug, collection?.id ?? null);
      }
      collectionId = collectionIds.get(fm.collectionSlug) ?? null;
    }

    const workId = fm.workSlug ? ((await findWork(fm.workSlug))?.id ?? null) : null;

    if (opts.dryRun) {
      console.log(`  [DRY RUN] Would upsert artwork: ${fm.sourceId} (author: ${fm.authorSlug})`);
      continue;
    }

    const data = {
      title: fm.title,
      objectDate: fm.objectDate ?? null,
      yearStart: fm.yearStart ?? null,
      yearEnd: fm.yearEnd ?? null,
      medium: fm.medium ?? null,
      artists: fm.artists ?? null,
      imageUrl: fm.imageUrl,
      imageSmallUrl: fm.imageSmallUrl ?? null,
      additionalImages: fm.additionalImages ?? [],
      museum: fm.museum,
      sourceUrl: fm.sourceUrl,
      creditLine: fm.creditLine ?? null,
      license: fm.license,
      authorId,
      collectionId,
      workId,
      order: fm.order ?? null,
    };

    await db.artwork.upsert({
      where: { sourceId: fm.sourceId },
      create: { sourceId: fm.sourceId, ...data, status: newStatus(opts, fm.status) },
      update: { ...data, ...statusUpdate(opts) },
    });
  }

  console.log(`  Upserted ${opts.dryRun ? 0 : files.length} artwork(s)`);
}
