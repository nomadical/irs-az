import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { fetchPdfPages, parseSection, type BookConfig } from '../scrapers/book-pdf';
import { writeWorkMd } from '../writers/md-writer';

const DATA_DIR = path.resolve(__dirname, '../../data');
const BOOKS_DIR = path.join(DATA_DIR, 'config/books');

/** Work files an earlier run wrote for this section (regenerated, not merged) */
function sectionFiles(authorSlug: string, collectionSlug: string, sourcePrefix: string): string[] {
  const dir = path.join(DATA_DIR, 'works', authorSlug, collectionSlug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(dir, f))
    .filter((f) => String(matter(fs.readFileSync(f, 'utf-8')).data.sourceId ?? '').startsWith(sourcePrefix));
}

export const scrapeBookCommand = new Command('scrape-book')
  .description('Split an edition (PDF with a text layer) into work .md files, per data/config/books/<id>.json')
  .requiredOption('--book <file>', 'Config file name in data/config/books, without .json')
  .option('--dry-run', 'Print the works and warnings without writing files')
  .action(async (opts: { book: string; dryRun?: boolean }) => {
    const book: BookConfig = JSON.parse(fs.readFileSync(path.join(BOOKS_DIR, `${opts.book}.json`), 'utf-8'));
    const pages = await fetchPdfPages(book.url);

    for (const section of book.sections) {
      const works = parseSection(pages, book, section);
      const lines = works.reduce((n, w) => n + w.body.split('\n').filter((l) => l && !l.startsWith('#')).length, 0);
      console.log(`\n${section.collectionSlug}: ${works.length} works, ${lines} lines`);
      for (const w of works) {
        console.log(`  ${String(w.n).padStart(3)}  p.${w.page}  ${w.titleAz}`);
        for (const warning of w.warnings) console.log(`         ! ${warning}`);
      }
      if (opts.dryRun) continue;

      const prefix = `${book.id}-${section.slugBase}`;
      for (const file of sectionFiles(book.authorSlug, section.collectionSlug, prefix)) fs.unlinkSync(file);

      for (const w of works) {
        writeWorkMd(
          {
            slug: w.slug,
            sourceId: w.sourceId,
            titleAz: w.titleAz,
            authorSlug: book.authorSlug,
            collectionSlug: section.collectionSlug,
            originalLang: 'AZ_LATIN',
            scriptDirection: 'LTR',
            genre: 'POEM',
            form: section.form,
            year: section.year,
            order: (section.orderFrom ?? 0) + w.n,
            // A bare URL, so the reading page links it; the page anchor opens the PDF there
            sourceNote: `${book.url}#page=${w.page}`,
            ...(w.previousSlugs && { previousSlugs: w.previousSlugs }),
            status: 'DRAFT',
          },
          w.body,
        );
      }
      console.log(`  Wrote ${works.length} works`);
    }
  });
