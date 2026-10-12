import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { loadBookConfig, planBookTranslation } from '../translations/book';
import { loadAnthologyConfig, planAnthology } from '../translations/anthology';
import { loadWikisourceConfig, planWikisourceTranslation } from '../translations/wikisource';
import { loadSplitConfig, planSplit } from '../translations/split';
import { loadPlayConfig, planPlay } from '../translations/play';
import { writeTranslationMd } from '../writers/md-writer';
import { slugify } from '../utils/slug';

const TRANSLATIONS_DIR = path.resolve(__dirname, '../../data/translations');
const CONFIG_DIR = path.resolve(__dirname, '../../data/config/translations');

/** Poems translated here and there in a book (Gibb), each matched to a work by hand */
async function scrapeAnthology(id: string, dryRun: boolean) {
  const cfg = loadAnthologyConfig(id);
  console.log(`\n=== ${cfg.title} (${cfg.translator}) ===`);
  const plan = await planAnthology(cfg);
  for (const m of plan.missing) console.error(`  Not found: ${m}`);

  const pct = (n: number) => ((100 * n) / Math.max(1, plan.ocr.words)).toFixed(1);
  console.log(`  OCR: ${plan.ocr.words} words, ${plan.ocr.fixed} fixed (${pct(plan.ocr.fixed)}%), ` +
    `${plan.ocr.unknown} still unknown (${pct(plan.ocr.unknown)}%)`);
  for (const c of plan.unusedCorrections) console.warn(`  Correction matched nothing: ${c.slice(0, 70)}`);
  for (const t of plan.items) {
    // A translation should have as many stanzas as the original; a mismatch means a page break
    // or footnote was misread, or the translator left stanzas out
    const flag = t.stanzas !== t.originalStanzas ? '  ⚠' : '';
    console.log(`  vol. ${t.volume} [${t.number}] ${t.stanzas}/${t.originalStanzas}${flag}  ${t.workSlug}`);
    if (dryRun) console.log(`       ${t.opening.slice(0, 120)}`);
  }
  if (dryRun) return;

  for (const t of plan.items) {
    writeTranslationMd(
      {
        workSlug: t.workSlug,
        language: 'EN',
        type: 'TRANSLATION',
        scriptDirection: 'LTR',
        translator: cfg.translator,
        translatorNote: `${cfg.title}, vol. ${['I', 'II', 'III', 'IV', 'V', 'VI'][t.volume - 1]} (${t.year}), ${t.label.toLowerCase()} no. ${t.number}.${cfg.proofread ? '' : ' OCR text from a scanned copy; may contain scanning errors.'}`,
        year: t.year,
        sourceNote: t.sourceUrl,
        isDefault: true,
        status: 'DRAFT',
      },
      t.body,
    );
  }
  console.log(`  Wrote ${plan.items.length} translations`);
}

/** A translation published on az.wikisource chapter by chapter, aligned to our works by hand */
async function scrapeWikisource(id: string, dryRun: boolean) {
  const cfg = loadWikisourceConfig(id);
  console.log(`\n=== ${cfg.title} (${cfg.translator}) ===`);
  const plan = await planWikisourceTranslation(cfg);
  for (const t of plan) {
    console.log(`  ${t.workSlug}: ${t.couplets} couplets  ← ${t.chapters.join(' + ')}`);
    for (const w of t.warnings) console.warn(`     ! ${w}`);
  }
  if (dryRun) return;

  for (const t of plan) {
    writeTranslationMd(
      {
        workSlug: t.workSlug,
        language: 'AZ_LATIN',
        type: 'TRANSLATION',
        scriptDirection: 'LTR',
        translator: cfg.translator,
        translatorNote: cfg.translatorNote,
        sourceNote: t.sourceUrl,
        isDefault: true,
        ...(cfg.hold && { hold: cfg.hold }),
        status: 'DRAFT',
      },
      t.body,
    );
  }
  console.log(`  Wrote ${plan.length} translations`);
}

/** A paraphrase printed as one poem, cut into our works at the lines the config names */
async function scrapeSplit(id: string, dryRun: boolean) {
  const cfg = loadSplitConfig(id);
  console.log(`\n=== ${cfg.title} (${cfg.translator}, ${cfg.year}) ===`);
  const plan = await planSplit(cfg);
  for (const c of plan.unusedCorrections) console.warn(`  Correction matched nothing: ${c.slice(0, 70)}`);
  for (const t of plan.translations) {
    console.log(`  ${t.workSlug}: ${t.couplets} couplets  ${t.opening.slice(0, 90)}`);
    for (const w of t.warnings) console.warn(`     ! ${w}`);
  }
  if (dryRun) return;

  for (const t of plan.translations) {
    writeTranslationMd(
      {
        workSlug: t.workSlug,
        language: 'EN',
        type: 'TRANSLATION',
        scriptDirection: 'LTR',
        translator: cfg.translator,
        translatorNote: cfg.translatorNote,
        year: cfg.year,
        sourceNote: `https://archive.org/details/${cfg.archiveId}`,
        isDefault: true,
        // Drafts until proofread against the scan
        status: 'DRAFT',
      },
      t.body,
    );
  }
  console.log(`  Wrote ${plan.translations.length} translations`);
}

/** A play translated in an old edition, each act set on the work for it */
async function scrapePlay(id: string, dryRun: boolean) {
  const cfg = loadPlayConfig(id);
  console.log(`\n=== ${cfg.title} (${cfg.translator}, ${cfg.year}) ===`);
  const plan = await planPlay(cfg);
  for (const c of plan.unusedCorrections) console.warn(`  Correction matched nothing: ${c.slice(0, 70)}`);
  for (const t of plan.translations) console.log(`  ${t.workSlug}: ${t.paragraphs} paragraphs  ${t.opening.replace(/\n/g, ' ').slice(0, 80)}`);
  if (dryRun) return;

  for (const t of plan.translations) {
    writeTranslationMd(
      {
        workSlug: t.workSlug,
        language: 'RU',
        type: 'TRANSLATION',
        scriptDirection: 'LTR',
        translator: cfg.translator,
        translatorNote: cfg.translatorNote,
        year: cfg.year,
        sourceNote: cfg.url,
        isDefault: true,
        // Drafts until proofread against the scan
        status: 'DRAFT',
      },
      t.body,
    );
  }
  console.log(`  Wrote ${plan.translations.length} translations`);
}

export const scrapeTranslationsCommand = new Command('scrape-translations')
  .description('Align a public-domain book translation to our works and write .md files')
  .requiredOption('--book <id>', 'Book config in data/config/translations, e.g. wilson-haft-paikar')
  .option('--dry-run', 'Report the alignment without writing files')
  .action(async (opts: { book: string; dryRun?: boolean }) => {
    const layout = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, `${opts.book}.json`), 'utf-8')).layout;
    if (layout === 'anthology') return scrapeAnthology(opts.book, !!opts.dryRun);
    if (layout === 'wikisource') return scrapeWikisource(opts.book, !!opts.dryRun);
    if (layout === 'split') return scrapeSplit(opts.book, !!opts.dryRun);
    if (layout === 'play') return scrapePlay(opts.book, !!opts.dryRun);

    const cfg = loadBookConfig(opts.book);
    console.log(`\n=== ${cfg.title} (${cfg.translator}, ${cfg.year}) ===`);

    const plan = await planBookTranslation(cfg);
    if (plan.missingHeadings.length) {
      console.error(`  Headings not found in the text (fix them in the config):`);
      for (const h of plan.missingHeadings) console.error(`    ${h}`);
      process.exit(1);
    }

    for (const c of plan.unusedCorrections) console.warn(`  Correction matched nothing: ${c.slice(0, 70)}`);
    const pct = (n: number) => ((100 * n) / Math.max(1, plan.ocr.words)).toFixed(1);
    console.log(`  OCR: ${plan.ocr.words} words, ${plan.ocr.fixed} fixed (${pct(plan.ocr.fixed)}%), ` +
      `${plan.ocr.unknown} still unknown (${pct(plan.ocr.unknown)}%)`);
    for (const t of plan.translations) {
      // Translations a fifth longer or shorter than the original suggest a misplaced boundary
      const ratio = t.couplets / Math.max(1, t.originalCouplets);
      const flag = ratio < 0.8 || ratio > 1.25 ? '  ⚠' : '';
      console.log(`  ${String(t.order).padStart(2)} ${t.couplets}/${t.originalCouplets}${flag}  ${t.workTitle.slice(0, 50)}`);
      if (opts.dryRun) console.log(`       ${t.opening.slice(0, 110)}`);
    }
    if (opts.dryRun) return;

    // Regenerate this translator's files rather than merging
    const translatorSlug = slugify(cfg.translator);
    for (const f of fs.existsSync(TRANSLATIONS_DIR) ? fs.readdirSync(TRANSLATIONS_DIR) : []) {
      if (f.endsWith(`.EN.TRANSLATION.${translatorSlug}.md`)) {
        const own = plan.translations.some((t) => f.startsWith(`${t.workSlug}.`));
        if (own) fs.unlinkSync(path.join(TRANSLATIONS_DIR, f));
      }
    }

    for (const t of plan.translations) {
      writeTranslationMd(
        {
          workSlug: t.workSlug,
          language: 'EN',
          type: 'TRANSLATION',
          scriptDirection: 'LTR',
          translator: cfg.translator,
          translatorNote: cfg.proofread ? cfg.title : `${cfg.title}. OCR text from a scanned copy; may contain scanning errors.`,
          year: cfg.year,
          sourceNote: plan.sourceUrl,
          isDefault: true,
          // Drafts until proofread against the scan
          status: 'DRAFT',
        },
        t.body,
      );
    }
    console.log(`  Wrote ${plan.translations.length} translations`);
  });
