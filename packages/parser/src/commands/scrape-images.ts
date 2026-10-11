import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthorConfig } from '../types';
import { planMetArtworks } from '../scrapers/met';
import { writeArtworkMd } from '../writers/md-writer';

const DATA_DIR = path.resolve(__dirname, '../../data');
const CONFIG_PATH = path.join(DATA_DIR, 'config/authors.json');

function loadAuthors(): AuthorConfig[] {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

type Source = 'met';

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

export const scrapeImagesCommand = new Command('scrape-images')
  .description('Collect public-domain artworks for authors from museum open-access APIs')
  .requiredOption('--source <source>', 'Source to scrape: met')
  .option('--author <slug>', 'Only scrape artworks for a specific author')
  .option('--dry-run', 'Print what would be written without writing files')
  .action(async (opts: { source: Source; author?: string; dryRun?: boolean }) => {
    const authors = loadAuthors().filter((a) => (opts.author ? a.slug === opts.author : a.met));
    if (authors.length === 0) {
      console.error(`No authors matched${opts.author ? ` slug "${opts.author}"` : ' with a met config'}`);
      process.exit(1);
    }

    for (const cfg of authors) {
      console.log(`\n=== ${cfg.nameAz} (${cfg.slug}) ===`);
      switch (opts.source) {
        case 'met':
          await scrapeMet(cfg, !!opts.dryRun);
          break;
        default:
          console.error(`Unknown source: ${opts.source}`);
          process.exit(1);
      }
    }
  });
