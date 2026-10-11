import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthorConfig } from '../types';
import { scrapeAuthorFromWikipedia } from '../scrapers/wikipedia';
import { writeAuthorMd } from '../writers/md-writer';
import { slugify } from '../utils/slug';

const CONFIG_PATH = path.resolve(__dirname, '../../data/config/authors.json');

function loadAuthors(): AuthorConfig[] {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw);
}

export const scrapeAuthorsCommand = new Command('scrape-authors')
  .description('Scrape author metadata from Wikipedia and write .md files')
  .option('--author <slug>', 'Only scrape a specific author by slug')
  .option('--dry-run', 'Print what would be scraped without writing files')
  .action(async (opts: { author?: string; dryRun?: boolean }) => {
    const authors = loadAuthors();
    const filtered = opts.author
      ? authors.filter((a) => a.slug === opts.author)
      : authors;

    if (filtered.length === 0) {
      console.error(`No authors matched${opts.author ? ` slug "${opts.author}"` : ''}`);
      process.exit(1);
    }

    console.log(`Scraping ${filtered.length} author(s)...\n`);

    for (const cfg of filtered) {
      const wikiAz = cfg.wikipedia?.az ?? cfg.nameAz;
      const wikiRu = cfg.wikipedia?.ru ?? cfg.nameRu;

      if (opts.dryRun) {
        console.log(`[DRY RUN] Would scrape: ${cfg.nameAz}`);
        console.log(`  AZ Wikipedia: ${wikiAz}`);
        if (wikiRu) console.log(`  RU Wikipedia: ${wikiRu}`);
        console.log();
        continue;
      }

      const scraped = await scrapeAuthorFromWikipedia(wikiAz, wikiRu);

      writeAuthorMd(
        {
          slug: cfg.slug,
          nameAz: cfg.nameAz,
          nameRu: scraped.nameRu ?? cfg.nameRu,
          nameFa: scraped.nameFa ?? cfg.nameFa,
          nameEn: scraped.nameEn ?? cfg.nameEn,
          bornYear: scraped.bornYear,
          bornYearApprox: scraped.bornYearApprox,
          diedYear: scraped.diedYear,
          diedYearApprox: scraped.diedYearApprox,
          bornPlace: scraped.bornPlace,
          diedPlace: scraped.diedPlace,
          type: cfg.type ?? scraped.type,
          period: cfg.period,
          writingLangs: cfg.writingLangs ?? scraped.writingLangs,
          portraitUrl: scraped.portraitUrl,
          portraitSource: scraped.portraitSource,
          status: 'DRAFT',
        },
        scraped.bioAz ?? '',
        scraped.bioRu,
      );

      console.log(`  Done: ${cfg.nameAz}\n`);
    }

    console.log('Author scraping complete.');
  });
