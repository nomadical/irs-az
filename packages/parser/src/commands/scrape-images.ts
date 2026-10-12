import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthorConfig } from '../types';
import { planMetArtworks } from '../scrapers/met';
import { planWaltersArtworks } from '../scrapers/walters';
import { planCommonsArtworks } from '../scrapers/commons';
import { writeArtworkMd } from '../writers/md-writer';

const DATA_DIR = path.resolve(__dirname, '../../data');
const CONFIG_PATH = path.join(DATA_DIR, 'config/authors.json');

function loadAuthors(): AuthorConfig[] {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

type Source = 'met' | 'walters' | 'commons';

async function scrapeMet(cfg: AuthorConfig, dryRun: boolean) {
  if (!cfg.met) {
    console.warn(`  No met config for ${cfg.slug}`);
    return;
  }

  const { artworks, candidates } = await planMetArtworks(cfg);
  const byCollection = new Map<string, number>();
  for (const a of artworks) {
    const key = a.collectionSlug ?? '(author only)';
    byCollection.set(key, (byCollection.get(key) ?? 0) + 1);
  }
  console.log(`  ${artworks.length} public-domain artworks credited to ${cfg.slug} (of ${candidates} candidates)`);
  for (const [coll, n] of byCollection) console.log(`    ${coll}: ${n}`);

  if (dryRun) {
    for (const a of artworks.slice(0, 10)) console.log(`    ${a.sourceId}  ${a.objectDate ?? ''}  ${a.title.slice(0, 70)}`);
    return;
  }

  // Regenerate rather than merge, so objects the Met withdraws or re-credits drop out
  const dir = path.join(DATA_DIR, 'artworks', cfg.slug);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) if (f.startsWith('met-')) fs.unlinkSync(path.join(dir, f));
  }

  artworks.forEach((a, i) =>
    writeArtworkMd({
      ...a,
      authorSlug: cfg.slug,
      museum: 'The Metropolitan Museum of Art',
      license: 'CC0',
      order: i + 1,
      status: 'DRAFT',
    }),
  );
  console.log(`  Wrote ${artworks.length} artworks`);
}

async function scrapeWalters(cfg: AuthorConfig, dryRun: boolean) {
  if (!cfg.walters) {
    console.warn(`  No walters config for ${cfg.slug}`);
    return;
  }
  const { artworks, skipped } = await planWaltersArtworks(cfg);
  const byCollection = new Map<string, number>();
  for (const a of artworks) byCollection.set(a.collectionSlug ?? '(author only)', (byCollection.get(a.collectionSlug ?? '(author only)') ?? 0) + 1);
  console.log(`  ${artworks.length} miniatures from ${cfg.walters.manuscripts.length} manuscripts (${skipped} skipped: other poets' works or no page image)`);
  for (const [coll, n] of byCollection) console.log(`    ${coll}: ${n}`);
  console.log(`  Licence: ${[...new Set(artworks.map((a) => a.license))].join(', ')}`);
  if (dryRun) {
    for (const a of artworks.slice(0, 8)) console.log(`    ${a.sourceId}  ${a.objectDate ?? ''}  ${a.title.slice(0, 80)}`);
    return;
  }

  const dir = path.join(DATA_DIR, 'artworks', cfg.slug);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) if (f.startsWith('walters-')) fs.unlinkSync(path.join(dir, f));
  }
  artworks.forEach((a, i) =>
    writeArtworkMd({
      ...a,
      authorSlug: cfg.slug,
      museum: 'The Walters Art Museum',
      order: i + 1,
      status: 'DRAFT',
    }),
  );
  console.log(`  Wrote ${artworks.length} artworks`);
}

async function scrapeCommons(cfg: AuthorConfig, dryRun: boolean) {
  if (!cfg.commons) {
    console.warn(`  No commons config for ${cfg.slug}`);
    return;
  }
  const { artworks, candidates, reasons } = await planCommonsArtworks(cfg);
  const byCollection = new Map<string, number>();
  for (const a of artworks) byCollection.set(a.collectionSlug ?? '(author only)', (byCollection.get(a.collectionSlug ?? '(author only)') ?? 0) + 1);
  console.log(`  ${artworks.length} illustrations kept of ${candidates} files`);
  for (const [coll, n] of byCollection) console.log(`    ${coll}: ${n}`);
  console.log(`  Dropped: ${Object.entries(reasons).map(([why, n]) => `${n} ${why}`).join('; ')}`);
  if (dryRun) {
    for (const a of artworks.slice(0, 10)) console.log(`    ${a.sourceId}  ${a.yearStart ?? '?'}  ${a.title.slice(0, 70)}  [${a.creditLine?.slice(0, 40) ?? ''}]`);
    return;
  }

  const dir = path.join(DATA_DIR, 'artworks', cfg.slug);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) if (f.startsWith('commons-')) fs.unlinkSync(path.join(dir, f));
  }
  artworks.forEach((a, i) =>
    writeArtworkMd({ ...a, authorSlug: cfg.slug, museum: 'Wikimedia Commons', order: i + 1, status: 'DRAFT' }),
  );
  console.log(`  Wrote ${artworks.length} artworks`);
}

export const scrapeImagesCommand = new Command('scrape-images')
  .description('Collect public-domain artworks for authors from museum open-access APIs')
  .requiredOption('--source <source>', 'Source to scrape: met, walters, commons')
  .option('--author <slug>', 'Only scrape artworks for a specific author')
  .option('--dry-run', 'Print what would be written without writing files')
  .action(async (opts: { source: Source; author?: string; dryRun?: boolean }) => {
    const authors = loadAuthors().filter((a) => (opts.author ? a.slug === opts.author : a[opts.source]));
    if (authors.length === 0) {
      console.error(`No authors matched${opts.author ? ` slug "${opts.author}"` : ` with a ${opts.source} config`}`);
      process.exit(1);
    }

    for (const cfg of authors) {
      console.log(`\n=== ${cfg.nameAz} (${cfg.slug}) ===`);
      switch (opts.source) {
        case 'met':
          await scrapeMet(cfg, !!opts.dryRun);
          break;
        case 'walters':
          await scrapeWalters(cfg, !!opts.dryRun);
          break;
        case 'commons':
          await scrapeCommons(cfg, !!opts.dryRun);
          break;
        default:
          console.error(`Unknown source: ${opts.source}`);
          process.exit(1);
      }
    }
  });
