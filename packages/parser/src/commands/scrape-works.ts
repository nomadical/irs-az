import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import type { AuthorConfig, Language, PoemForm } from '../types';
import { listWorksOnWikisource, scrapeWork } from '../scrapers/wikisource';
import { planWikisourceAz } from '../scrapers/wikisource-az';
import {
  scrapeGanjoorCollectionRecursive,
  mapGanjoorForm,
  discoverGanjoorCollections,
} from '../scrapers/ganjoor';
import { writeCollectionMd, writeWorkMd, writeTranslationMd } from '../writers/md-writer';
import { slugify } from '../utils/slug';
import { detectScript } from '../utils/wikitext';
import { GANJOOR_COLLECTION_TITLES, ganjoorSlug, ganjoorTitles } from '../utils/ganjoor-slug';

const DATA_DIR = path.resolve(__dirname, '../../data');
const CONFIG_PATH = path.join(DATA_DIR, 'config/authors.json');

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

/** Work files an earlier az.wikisource run wrote for this author (regenerated, not merged) */
function wikisourceAzFiles(authorSlug: string): string[] {
  const dir = path.join(DATA_DIR, 'works', authorSlug);
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const full = path.join(entry.parentPath, entry.name);
    const { data } = matter(fs.readFileSync(full, 'utf-8'));
    if (typeof data.sourceNote === 'string' && data.sourceNote.includes('az.wikisource.org')) {
      files.push(full);
    }
  }
  return files;
}

async function scrapeWikisourceAz(cfg: AuthorConfig, dryRun: boolean) {
  if (!cfg.wikisource?.az) {
    console.warn(`  No wikisource.az configured for ${cfg.slug}`);
    return;
  }

  console.log(`\nWalking Müəllif:${cfg.wikisource.az} on az.wikisource.org...`);
  const plan = await planWikisourceAz(cfg);

  for (const coll of plan.collections) {
    const works = plan.works.filter((w) => w.collectionSlug === coll.slug);
    console.log(`  ${coll.slug} — ${coll.titleAz} (${coll.genre}, ${works.length} works)`);
    if (dryRun) for (const w of works.slice(0, 3)) console.log(`      ${w.slug}  ${w.form ?? ''}`);
  }

  const reasons = [...new Set(plan.skipped.map((s) => s.reason))];
  for (const reason of reasons) {
    const pages = plan.skipped.filter((s) => s.reason === reason);
    console.log(`  Skipped ${pages.length} (${reason})`);
    for (const p of pages.slice(0, dryRun ? 10 : 3)) {
      console.log(`      ${p.title}${p.detail ? ` — ${p.detail}` : ''}`);
    }
  }

  if (dryRun) {
    console.log(`[DRY RUN] ${plan.works.length} works in ${plan.collections.length} collections`);
    return;
  }

  const stale = wikisourceAzFiles(cfg.slug);
  for (const file of stale) fs.unlinkSync(file);
  if (stale.length) console.log(`  Removed ${stale.length} work files from the previous run`);

  for (const coll of plan.collections) {
    // Collection files get hand-edited (RU/EN titles), so only create missing ones
    if (fs.existsSync(path.join(DATA_DIR, 'collections', cfg.slug, `${coll.slug}.md`))) continue;
    writeCollectionMd({
      slug: coll.slug,
      titleAz: coll.titleAz,
      authorSlug: cfg.slug,
      genre: coll.genre,
      originalLang: 'AZ_LATIN',
      year: coll.year,
      order: coll.order,
      status: 'DRAFT',
    });
  }

  for (const w of plan.works) {
    writeWorkMd(
      {
        slug: w.slug,
        sourceId: w.sourceId,
        titleAz: w.titleAz,
        authorSlug: cfg.slug,
        collectionSlug: w.collectionSlug,
        originalLang: 'AZ_LATIN',
        scriptDirection: w.scriptDirection,
        genre: w.genre,
        form: w.form,
        year: w.year,
        order: w.order,
        sourceNote: w.sourceNote,
        status: 'DRAFT',
      },
      w.body,
    );
  }

  console.log(`  Wrote ${plan.works.length} works in ${plan.collections.length} collections`);
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
    const colTitles = GANJOOR_COLLECTION_TITLES[col.collectionSlug];
    writeCollectionMd({
      slug: col.collectionSlug,
      titleAz: colTitles?.az ?? col.collectionSlug, // Unmapped collections need manual editing
      titleRu: colTitles?.ru,
      titleEn: colTitles?.en,
      authorSlug: cfg.slug,
      genre: 'POEM',
      originalLang: 'FA',
      status: 'DRAFT',
    });

    const poems = await scrapeGanjoorCollectionRecursive(col.catUrl);
    const form = col.form ?? mapGanjoorForm(col.catUrl);

    for (const poem of poems) {
      const sourceId = `ganjoor-${poem.ganjoorId}`;
      if (cfg.skipSources?.includes(sourceId)) continue;
      const workSlug = ganjoorSlug(cfg.slug, poem.sourceUrl) ?? sourceId;
      const titles = ganjoorTitles(poem.sourceUrl);

      writeWorkMd(
        {
          slug: workSlug,
          sourceId,
          titleAz: titles?.az ?? poem.titleFa, // Unmapped sections need manual editing
          titleRu: titles?.ru,
          titleFa: poem.titleFa,
          titleEn: titles?.en,
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
          await scrapeWikisourceAz(cfg, !!opts.dryRun);
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
