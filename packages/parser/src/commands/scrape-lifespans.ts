import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import type { AuthorConfig } from '../types';
import { findLifespan } from '../scrapers/lifespan';

const DATA_DIR = path.resolve(__dirname, '../../data');

export const scrapeLifespansCommand = new Command('scrape-lifespans')
  .description("Add Wikidata birth and death years to authors' .md files")
  .option('--author <slug>', 'Only this author')
  .option('--dry-run', 'Print what would be written')
  .action(async (opts: { author?: string; dryRun?: boolean }) => {
    const authors: AuthorConfig[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config/authors.json'), 'utf-8'));
    for (const cfg of authors.filter((a) => !opts.author || a.slug === opts.author)) {
      const life = await findLifespan(cfg);
      if (!life) {
        console.log(`  ${cfg.slug.padEnd(14)} not on Wikidata`);
        continue;
      }
      const fmt = (y?: number, approx?: boolean) => (y ? `${approx ? '~' : ''}${y}` : '?');
      console.log(`  ${cfg.slug.padEnd(14)} ${life.wikidata.padEnd(10)} ${fmt(life.bornYear, life.bornYearApprox)}–${fmt(life.diedYear, life.diedYearApprox)}`);
      if (opts.dryRun) continue;

      // Update the author's file in place: other frontmatter and the bio stay as they are
      const file = path.join(DATA_DIR, 'authors', `${cfg.slug}.md`);
      if (!fs.existsSync(file)) {
        console.warn(`    no ${path.relative(DATA_DIR, file)}; run scrape-authors first`);
        continue;
      }
      const md = matter(fs.readFileSync(file, 'utf-8'));
      // Wikidata's years replace the file's; where it has none, or the same year, what was set by
      // hand stays (Tufarqanlı's unsourced 1600 is marked approximate in his file only)
      for (const [year, approx] of [['bornYear', 'bornYearApprox'], ['diedYear', 'diedYearApprox']] as const) {
        if (life[year] == null) continue;
        if (md.data[year] !== life[year]) {
          md.data[year] = life[year];
          delete md.data[approx];
        }
        if (life[approx]) md.data[approx] = true;
      }
      fs.writeFileSync(file, matter.stringify(md.content, md.data), 'utf-8');
    }
  });
