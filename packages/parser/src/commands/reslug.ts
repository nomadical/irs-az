import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { Command } from 'commander';
import { disconnectDb, getDb } from '../importers/db';
import { ganjoorSlug, isLegacyGanjoorSlug } from '../utils/ganjoor-slug';
import { slugify } from '../utils/slug';

const WORKS_DIR = path.resolve(__dirname, '../../data/works');
const READABLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : e.name.endsWith('.md') ? [full] : [];
  });
}

/** Insert sourceId right after slug, keeping the rest of the frontmatter order. */
function withSlug(data: Record<string, unknown>, slug: string, sourceId: string) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'sourceId') continue;
    out[k] = k === 'slug' ? slug : v;
    if (k === 'slug') out.sourceId = sourceId;
  }
  return out;
}

/**
 * One-off: replace "ganjoor-NNN" work slugs with readable ones (fuzuli-qezel-7) in both
 * the .md files and the database, keeping the old slug as sourceId and for redirects.
 * Also cleans up any DB-only slugs with non-ASCII characters. Safe to re-run.
 */
export const reslugCommand = new Command('reslug')
  .description('Give works readable slugs; old slugs keep redirecting')
  .option('--dry-run', 'Show the renames without writing anything')
  .action(async (opts: { dryRun?: boolean }) => {
    const renames = new Map<string, string>(); // old slug → new slug

    // 1. Markdown sources
    for (const file of walk(WORKS_DIR)) {
      const raw = fs.readFileSync(file, 'utf-8');
      const { data, content } = matter(raw);
      if (!isLegacyGanjoorSlug(data.slug)) continue;

      const slug = ganjoorSlug(data.authorSlug, data.sourceNote);
      if (!slug) {
        console.warn(`  No readable slug for ${data.slug} (${data.sourceNote})`);
        continue;
      }
      renames.set(data.slug, slug);
      if (opts.dryRun) continue;

      const updated = matter.stringify(content, withSlug(data, slug, data.slug));
      const target = path.join(path.dirname(file), path.basename(file).replace(data.slug, slug));
      fs.writeFileSync(target, updated, 'utf-8');
      if (target !== file) fs.unlinkSync(file);
    }

    // 2. Database
    const db = getDb();
    const works = await db.work.findMany({ select: { id: true, slug: true, sourceId: true } });
    const taken = new Set(works.map((w) => w.slug));
    let changed = 0;

    for (const work of works) {
      const next =
        renames.get(work.slug) ?? (READABLE.test(work.slug) ? null : slugify(work.slug));
      if (!next || next === work.slug) continue;
      if (taken.has(next)) {
        console.warn(`  Skipping ${work.slug}: "${next}" is already taken`);
        continue;
      }
      console.log(`  ${work.slug} → ${next}`);
      taken.add(next);
      changed++;
      if (opts.dryRun) continue;

      await db.work.update({
        where: { id: work.id },
        data: {
          slug: next,
          sourceId: work.sourceId ?? (isLegacyGanjoorSlug(work.slug) ? work.slug : null),
          previousSlugs: { push: work.slug },
        },
      });
    }

    console.log(`\n${opts.dryRun ? '[DRY RUN] ' : ''}${renames.size} md file(s), ${changed} DB work(s) renamed`);
    await disconnectDb();
  });
