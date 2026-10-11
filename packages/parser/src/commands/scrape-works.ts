import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthorConfig, Language, PoemForm } from '../types';
import { listWorksOnWikisource, scrapeWork } from '../scrapers/wikisource';
import {
  scrapeGanjoorCollectionRecursive,
  mapGanjoorForm,
  discoverGanjoorCollections,
} from '../scrapers/ganjoor';
import { writeCollectionMd, writeWorkMd, writeTranslationMd } from '../writers/md-writer';
import { slugify } from '../utils/slug';
import { detectScript } from '../utils/wikitext';

const CONFIG_PATH = path.resolve(__dirname, '../../data/config/authors.json');

function loadAuthors(): AuthorConfig[] {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw);
}

type Source = 'wikisource-az' | 'wikisource-ru' | 'ganjoor';

async function scrapeWikisource(
  cfg: AuthorConfig,
  site: string,
  lang: Language,
  dryRun: boolean,
) {
  const wikiKey = lang === 'AZ_LATIN' ? 'az' : 'ru';
  const authorPage = cfg.wikisource?.[wikiKey];
  if (!authorPage) {
    console.warn(`  No wikisource.${wikiKey} configured for ${cfg.slug}`);
    return;
  }

  const siteHost = lang === 'AZ_LATIN' ? 'az.wikisource.org' : 'ru.wikisource.org';
  console.log(`\nListing works on ${siteHost} for ${authorPage}...`);

  const titles = await listWorksOnWikisource(siteHost, authorPage);

  if (dryRun) {
    console.log(`[DRY RUN] Found ${titles.length} pages:`);
    for (const t of titles.slice(0, 20)) console.log(`  - ${t}`);
    if (titles.length > 20) console.log(`  ... and ${titles.length - 20} more`);
    return;
  }

  // Determine the target collection for these works
  const collSlugOverride = lang === 'AZ_LATIN'
    ? cfg.wikisource?.az_collection
    : cfg.wikisource?.ru_collection;
  const defaultCollection = collSlugOverride
    ? cfg.collections?.find((c) => c.slug === collSlugOverride)
    : cfg.collections?.[0];
  if (defaultCollection) {
    writeCollectionMd({
      slug: defaultCollection.slug,
      titleAz: defaultCollection.titleAz,
      titleRu: defaultCollection.titleRu,
      titleFa: defaultCollection.titleFa,
      authorSlug: cfg.slug,
      genre: defaultCollection.genre,
      originalLang: defaultCollection.originalLang,
      year: defaultCollection.year,
      status: 'DRAFT',
    });
  }

  let order = 1;
  for (const title of titles) {
    const work = await scrapeWork(siteHost, title);
    if (!work) continue;

    const workSlug = slugify(work.title);
    const collSlug = defaultCollection?.slug;
    const scriptDir = detectScript(work.body);

    if (lang === 'AZ_LATIN') {
      // Write as primary work
      writeWorkMd(
        {
          slug: workSlug,
          titleAz: work.title,
          authorSlug: cfg.slug,
          collectionSlug: collSlug,
          originalLang: lang,
          scriptDirection: scriptDir,
          genre: defaultCollection?.genre ?? 'POEM',
          order: order++,
          sourceNote: work.sourceUrl,
          status: 'DRAFT',
        },
        work.body,
      );
    } else {
      // Write as a translation of an existing work
      writeTranslationMd(
        {
          workSlug,
          language: lang,
          type: 'TRANSLATION',
          scriptDirection: scriptDir,
          sourceNote: work.sourceUrl,
          status: 'DRAFT',
        },
        work.body,
      );
    }
  }

  console.log(`  Wrote ${order - 1} works from ${siteHost}`);
}

async function scrapeGanjoor(cfg: AuthorConfig, dryRun: boolean) {
  let collections = cfg.ganjoor?.collections ?? [];

  // Auto-discover collections if configured and none are explicitly listed
  if (cfg.ganjoor?.autoDiscover && collections.length === 0 && cfg.ganjoor.poetUrl) {
    const poetSlug = cfg.ganjoor.poetUrl.replace(/^https?:\/\/ganjoor\.net\/?/, '');
    const discovered = await discoverGanjoorCollections(poetSlug);
    collections = discovered.map((d) => ({
      catUrl: d.catUrl,
      collectionSlug: slugify(d.title) || slugify(poetSlug + '-' + d.title),
      form: d.form,
    }));
    console.log(`  Auto-discovered ${collections.length} collections for ${cfg.slug}`);
  }

  if (collections.length === 0) {
    console.warn(`  No ganjoor collections configured or discovered for ${cfg.slug}`);
    return;
  }

  for (const col of collections) {
    console.log(`\nScraping Ganjoor collection: ${col.catUrl}`);

    if (dryRun) {
      console.log(`[DRY RUN] Would scrape: ${col.catUrl} → ${col.collectionSlug}`);
      continue;
    }

    // Write collection MD
    writeCollectionMd({
      slug: col.collectionSlug,
      titleAz: col.collectionSlug, // Will need manual editing
      authorSlug: cfg.slug,
      genre: 'POEM',
      originalLang: 'FA',
      status: 'DRAFT',
    });

    const poems = await scrapeGanjoorCollectionRecursive(col.catUrl);
    const form = col.form ?? mapGanjoorForm(col.catUrl);

    for (const poem of poems) {
      const workSlug = slugify(poem.titleFa) || `ganjoor-${poem.ganjoorId}`;

      writeWorkMd(
        {
          slug: workSlug,
          titleAz: poem.titleFa, // Will need manual editing
          titleFa: poem.titleFa,
          authorSlug: cfg.slug,
          collectionSlug: col.collectionSlug,
          originalLang: 'FA',
          scriptDirection: 'RTL',
          genre: 'POEM',
          form,
          order: poem.order,
          sourceNote: poem.sourceUrl,
          status: 'DRAFT',
        },
        poem.body,
      );
    }

    console.log(`  Wrote ${poems.length} poems from Ganjoor`);
  }
}

export const scrapeWorksCommand = new Command('scrape-works')
  .description('Scrape works from Wikisource or Ganjoor and write .md files')
  .requiredOption(
    '--source <source>',
    'Source to scrape: wikisource-az, wikisource-ru, ganjoor',
  )
  .option('--author <slug>', 'Only scrape works for a specific author')
  .option('--dry-run', 'Print what would be scraped without writing files')
  .action(async (opts: { source: Source; author?: string; dryRun?: boolean }) => {
    const authors = loadAuthors();
    const filtered = opts.author
      ? authors.filter((a) => a.slug === opts.author)
      : authors;

    if (filtered.length === 0) {
      console.error(`No authors matched${opts.author ? ` slug "${opts.author}"` : ''}`);
      process.exit(1);
    }

    for (const cfg of filtered) {
      console.log(`\n=== ${cfg.nameAz} (${cfg.slug}) ===`);

      switch (opts.source) {
        case 'wikisource-az':
          await scrapeWikisource(cfg, 'az.wikisource.org', 'AZ_LATIN', !!opts.dryRun);
          break;
        case 'wikisource-ru':
          await scrapeWikisource(cfg, 'ru.wikisource.org', 'RU', !!opts.dryRun);
          break;
        case 'ganjoor':
          await scrapeGanjoor(cfg, !!opts.dryRun);
          break;
        default:
          console.error(`Unknown source: ${opts.source}`);
          process.exit(1);
      }
    }

    console.log('\nWork scraping complete.');
  });
