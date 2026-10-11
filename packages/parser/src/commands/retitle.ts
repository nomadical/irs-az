import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { Command } from 'commander';
import { disconnectDb, getDb } from '../importers/db';
import { GANJOOR_COLLECTION_TITLES, ganjoorTitles } from '../utils/ganjoor-slug';

const DATA_DIR = path.resolve(__dirname, '../../data');
const LEADING_KEYS = ['slug', 'sourceId', 'titleAz', 'titleRu', 'titleFa', 'titleEn'];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : e.name.endsWith('.md') ? [full] : [];
  });
}

/** Merge fields into frontmatter, keeping slug and titles at the top in a fixed order. */
function merge(data: Record<string, unknown>, fields: Record<string, string>) {
  const all = { ...data, ...fields };
  const out: Record<string, unknown> = {};
  for (const k of LEADING_KEYS) if (all[k] !== undefined) out[k] = all[k];
  for (const [k, v] of Object.entries(all)) if (!(k in out)) out[k] = v;
  return out;
}

function rewrite(file: string, fields: Record<string, string>) {
  const { data, content } = matter(fs.readFileSync(file, 'utf-8'));
  fs.writeFileSync(file, matter.stringify(content, merge(data, fields)), 'utf-8');
}

/**
 * One-off: replace placeholder titles of Ganjoor imports (the Persian "شمارهٔ ۷" copied into
 * titleAz, or a collection's slug) with AZ/RU/EN titles like "Qəzəl 7". Titles an editor
 * has already changed are left alone. Safe to re-run.
 */
export const retitleCommand = new Command('retitle')
  .description('Give Ganjoor works and collections readable AZ/RU/EN titles')
  .option('--dry-run', 'Show the changes without writing anything')
  .action(async (opts: { dryRun?: boolean }) => {
    const db = getDb();
    let mdWorks = 0;
    let mdCollections = 0;

    // 1. Markdown sources
    for (const file of walk(path.join(DATA_DIR, 'works'))) {
      const { data } = matter(fs.readFileSync(file, 'utf-8'));
      if (!data.sourceId || data.titleAz !== data.titleFa) continue;
      const t = ganjoorTitles(data.sourceNote);
      if (!t) continue;
      mdWorks++;
      if (!opts.dryRun) rewrite(file, { titleAz: t.az, titleRu: t.ru, titleEn: t.en });
    }
    for (const file of walk(path.join(DATA_DIR, 'collections'))) {
      const { data } = matter(fs.readFileSync(file, 'utf-8'));
      const t = GANJOOR_COLLECTION_TITLES[data.slug];
      if (!t || data.titleAz !== data.slug) continue;
      mdCollections++;
      if (!opts.dryRun) rewrite(file, { titleAz: t.az, titleRu: t.ru, titleEn: t.en });
    }

    // 2. Database
    const works = await db.work.findMany({
      where: { sourceId: { not: null } },
      select: { id: true, slug: true, titleAz: true, titleFa: true, sourceNote: true },
    });
    let dbWorks = 0;
    for (const w of works) {
      const t = w.titleAz === w.titleFa ? ganjoorTitles(w.sourceNote) : null;
      if (!t) continue;
      dbWorks++;
      if (dbWorks <= 5 || opts.dryRun) console.log(`  ${w.slug}: ${w.titleAz} → ${t.az} / ${t.ru} / ${t.en}`);
      if (!opts.dryRun) {
        await db.work.update({ where: { id: w.id }, data: { titleAz: t.az, titleRu: t.ru, titleEn: t.en } });
      }
    }

    let dbCollections = 0;
    for (const [slug, t] of Object.entries(GANJOOR_COLLECTION_TITLES)) {
      const c = await db.collection.findUnique({ where: { slug }, select: { id: true, titleAz: true } });
      if (!c || c.titleAz !== slug) continue;
      dbCollections++;
      console.log(`  collection ${slug} → ${t.az} / ${t.ru} / ${t.en}`);
      if (!opts.dryRun) {
        await db.collection.update({ where: { id: c.id }, data: { titleAz: t.az, titleRu: t.ru, titleEn: t.en } });
      }
    }

    console.log(
      `\n${opts.dryRun ? '[DRY RUN] ' : ''}md: ${mdWorks} works, ${mdCollections} collections · ` +
        `db: ${dbWorks} works, ${dbCollections} collections`,
    );
    await disconnectDb();
  });
