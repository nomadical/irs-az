import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { loadBookConfig, planBookTranslation } from '../translations/book';
import { loadAnthologyConfig, planAnthology } from '../translations/anthology';
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
        translatorNote: `${cfg.title}, vol. ${['I', 'II', 'III', 'IV', 'V', 'VI'][t.volume - 1]} (${t.year}), ${t.label.toLowerCase()} no. ${t.number}. OCR text from a scanned copy; may contain scanning errors.`,
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

export const scrapeTranslationsCommand = new Command('scrape-translations')
  .description('Align a public-domain book translation to our works and write .md files')
  .requiredOption('--book <id>', 'Book config in data/config/translations, e.g. wilson-haft-paikar')
  .option('--dry-run', 'Report the alignment without writing files')
  .action(async (opts: { book: string; dryRun?: boolean }) => {
    const layout = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, `${opts.book}.json`), 'utf-8')).layout;
    if (layout === 'anthology') return scrapeAnthology(opts.book, !!opts.dryRun);

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
          translatorNote: `${cfg.title}. OCR text from a scanned copy; may contain scanning errors.`,
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
