import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import type { AuthorConfig } from '../types';
import { findPortrait } from '../scrapers/portraits';

const DATA_DIR = path.resolve(__dirname, '../../data');

export const scrapePortraitsCommand = new Command('scrape-portraits')
  .description("Add Wikidata/Commons portraits to authors' .md files")
  .option('--author <slug>', 'Only this author')
  .option('--dry-run', 'Print what would be written')
  .action(async (opts: { author?: string; dryRun?: boolean }) => {
    const authors: AuthorConfig[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config/authors.json'), 'utf-8'));
    for (const cfg of authors.filter((a) => !opts.author || a.slug === opts.author)) {
      const portrait = await findPortrait(cfg);
      if (!portrait) {
        console.log(`  ${cfg.slug.padEnd(10)} no portrait on Wikidata`);
        continue;
      }
      console.log(`  ${cfg.slug.padEnd(10)} ${portrait.wikidata.padEnd(10)} ${portrait.file.slice(0, 40).padEnd(40)} ${portrait.credit}`);
      if (opts.dryRun) continue;

      // Update the author's file in place: other frontmatter and the bio stay as they are
      const file = path.join(DATA_DIR, 'authors', `${cfg.slug}.md`);
      if (!fs.existsSync(file)) {
        console.warn(`    no ${path.relative(DATA_DIR, file)}; run scrape-authors first`);
        continue;
      }
      const md = matter(fs.readFileSync(file, 'utf-8'));
      md.data.portraitUrl = portrait.url;
      md.data.portraitSource = portrait.source;
      md.data.portraitCredit = portrait.credit;
      fs.writeFileSync(file, matter.stringify(md.content, md.data), 'utf-8');
    }
  });
