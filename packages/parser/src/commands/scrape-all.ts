import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthorConfig } from '../types';

const CONFIG_PATH = path.resolve(__dirname, '../../data/config/authors.json');

function loadAuthors(): AuthorConfig[] {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Run all configured sources for an author (or all authors) in sequence:
 * scrape-authors → scrape-works wikisource-az → wikisource-ru → ganjoor
 *
 * Delegates to existing commands via child process to reuse their logic.
 */
export const scrapeAllCommand = new Command('scrape-all')
  .description('Run all scrape stages for an author (or all authors) in sequence')
  .option('--author <slug>', 'Only scrape a specific author')
  .option('--dry-run', 'Print what would be scraped without writing files')
  .action(async (opts: { author?: string; dryRun?: boolean }) => {
    const { execFileSync } = await import('child_process');

    const authors = loadAuthors();
    const filtered = opts.author
      ? authors.filter((a) => a.slug === opts.author)
      : authors;

    if (filtered.length === 0) {
      console.error(`No authors matched${opts.author ? ` slug "${opts.author}"` : ''}`);
      process.exit(1);
    }

    const tsxBin = 'npx';
    const indexPath = path.resolve(__dirname, '../index.ts');
    const dryFlag = opts.dryRun ? ['--dry-run'] : [];

    for (const cfg of filtered) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`  ${cfg.nameAz} (${cfg.slug})`);
      console.log(`${'='.repeat(60)}`);

      // 1. Scrape author bio from Wikipedia
      console.log(`\n--- scrape-authors ---`);
      try {
        execFileSync(tsxBin, ['tsx', indexPath, 'scrape-authors', '--author', cfg.slug, ...dryFlag], {
          stdio: 'inherit',
        });
      } catch {
        console.warn(`  Warning: scrape-authors failed for ${cfg.slug}, continuing...`);
      }

      // 2. Wikisource AZ
      if (cfg.wikisource?.az) {
        console.log(`\n--- scrape-works --source wikisource-az ---`);
        try {
          execFileSync(tsxBin, ['tsx', indexPath, 'scrape-works', '--source', 'wikisource-az', '--author', cfg.slug, ...dryFlag], {
            stdio: 'inherit',
          });
        } catch {
          console.warn(`  Warning: wikisource-az scraping failed for ${cfg.slug}, continuing...`);
        }
      }

      // 3. Wikisource RU
      if (cfg.wikisource?.ru) {
        console.log(`\n--- scrape-works --source wikisource-ru ---`);
        try {
          execFileSync(tsxBin, ['tsx', indexPath, 'scrape-works', '--source', 'wikisource-ru', '--author', cfg.slug, ...dryFlag], {
            stdio: 'inherit',
          });
        } catch {
          console.warn(`  Warning: wikisource-ru scraping failed for ${cfg.slug}, continuing...`);
        }
      }

      // 4. Ganjoor
      if (cfg.ganjoor?.poetUrl) {
        console.log(`\n--- scrape-works --source ganjoor ---`);
        try {
          execFileSync(tsxBin, ['tsx', indexPath, 'scrape-works', '--source', 'ganjoor', '--author', cfg.slug, ...dryFlag], {
            stdio: 'inherit',
          });
        } catch {
          console.warn(`  Warning: ganjoor scraping failed for ${cfg.slug}, continuing...`);
        }
      }
    }

    console.log(`\nAll scraping complete.`);
  });
