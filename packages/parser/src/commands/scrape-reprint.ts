import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthorConfig } from '../types';
import { planReprint } from '../scrapers/latin-reprint';
import { writeCollectionMd, writeWorkMd } from '../writers/md-writer';

const CONFIG_PATH = path.resolve(__dirname, '../../data/config/authors.json');

export const scrapeReprintCommand = new Command('scrape-reprint')
  .description("Scrape an author's Latin-script state reprint (National Library PDFs) into .md files")
  .requiredOption('--author <slug>', 'Author slug, with a "reprint" entry in authors.json')
  .option('--dry-run', 'Print the plan without writing files')
  .action(async (opts: { author: string; dryRun?: boolean }) => {
    const cfg = (JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as AuthorConfig[]).find((a) => a.slug === opts.author);
    if (!cfg?.reprint) {
      console.error(`No reprint config for "${opts.author}"`);
      process.exit(1);
    }
    const plan = await planReprint(cfg.slug, cfg.reprint.volumes);
    for (const c of plan.collections) {
      const works = plan.works.filter((w) => w.collectionSlug === c.slug);
      console.log(`  ${c.slug.padEnd(45)} ${String(works.length).padStart(4)}  ${c.titleAz}`);
    }
    console.log(`  ${plan.works.length} works in ${plan.collections.length} collections`);
    if (opts.dryRun) return;

    for (const c of plan.collections) {
      writeCollectionMd({ slug: c.slug, titleAz: c.titleAz, authorSlug: cfg.slug, genre: c.genre, originalLang: 'AZ_LATIN', year: c.year, order: c.order, status: 'DRAFT' });
      plan.works
        .filter((w) => w.collectionSlug === c.slug)
        .forEach((w, i) => {
          writeWorkMd(
            {
              slug: w.slug, sourceId: w.sourceId, titleAz: w.titleAz, authorSlug: cfg.slug, collectionSlug: c.slug,
              originalLang: 'AZ_LATIN', scriptDirection: 'LTR', genre: w.genre, form: w.form, year: w.year,
              order: i + 1, sourceNote: w.sourceNote, status: 'DRAFT',
            },
            w.body,
          );
        });
    }
    console.log('Done.');
  });
