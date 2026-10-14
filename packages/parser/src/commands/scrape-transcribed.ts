import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthorConfig, Genre } from '../types';
import { parts, type Layout } from '../scrapers/latin-reprint';
import { shortSlug } from '../scrapers/wikisource-az';
import { writeCollectionMd, writeWorkMd } from '../writers/md-writer';

const DATA_DIR = path.resolve(__dirname, '../../data');

export interface TranscribedSection {
  /** Title of the section's first work; the section runs to the next one's */
  first: string;
  collection: string;
  titleAz: string;
  genre: Genre;
  layout: Layout;
  /** Numbered short pieces ("### 17"): one work each, "Balaca mütəfərriqələr 17" */
  pieces?: boolean;
}

export interface TranscribedBook {
  /** In data/proofread: "@@ NNN" opens each scanned spread, "# Title" each work, ">>" a paragraph run on from the spread before */
  file: string;
  /** The National Library reader's book id the spreads are numbered in */
  bibid: number;
  sections: TranscribedSection[];
}

const readerUrl = (bibid: number, page: number) => `http://web2.anl.az:81/read/page.php?bibid=${bibid}&pno=${page}`;

/** The book's works in order: title, the spread it starts on, and its Markdown */
export function readTranscription(text: string) {
  const works: { title: string; spread: number; body: string }[] = [];
  let spread = 0;
  let lines: string[] = [];
  const flush = () => {
    if (works.length) works[works.length - 1].body = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    lines = [];
  };
  for (const line of text.split('\n')) {
    const at = line.match(/^@@ (\d+)$/);
    if (at) { spread = Number(at[1]); continue; }
    const title = line.match(/^# (.+)$/);
    if (title) {
      flush();
      works.push({ title: title[1].trim(), spread, body: '' });
      continue;
    }
    if (line.startsWith('>>')) {
      // The paragraph the spread before broke off: join it back up, mending a word split at the turn
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      const prev = lines.pop() ?? '';
      const rest = line.slice(2);
      lines.push(/\p{L}-$/u.test(prev) && /^\p{Ll}/u.test(rest) ? prev.slice(0, -1) + rest : `${prev} ${rest}`.trim());
      continue;
    }
    lines.push(line);
  }
  flush();
  return works;
}

export const scrapeTranscribedCommand = new Command('scrape-transcribed')
  .description('Turn a book typed from scans (data/proofread) into .md files, cut at its works and a play\'s acts')
  .requiredOption('--author <slug>', 'Author slug, with a "transcribed" entry in authors.json')
  .option('--dry-run', 'Print the plan without writing files')
  .action((opts: { author: string; dryRun?: boolean }) => {
    const cfg = (JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config/authors.json'), 'utf-8')) as AuthorConfig[])
      .find((a) => a.slug === opts.author);
    const book = cfg?.transcribed;
    if (!cfg || !book) {
      console.error(`No transcribed config for "${opts.author}"`);
      process.exit(1);
    }
    const works = readTranscription(fs.readFileSync(path.join(DATA_DIR, 'proofread', book.file), 'utf-8'));
    for (const s of book.sections) if (!works.some((w) => w.title === s.first)) console.warn(`  Section start not found: ${s.first}`);

    const used = new Set<string>();
    const unique = (base: string) => {
      let slug = base;
      for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
      used.add(slug);
      return slug;
    };
    let section: TranscribedSection | undefined;
    let collOrder = 0;
    const order = new Map<string, number>();
    const collection = (slug: string, titleAz: string, genre: Genre) => {
      if (order.has(slug)) return;
      order.set(slug, 0);
      console.log(`  ${slug}  ${titleAz}`);
      if (!opts.dryRun) writeCollectionMd({ slug, titleAz, authorSlug: cfg.slug, genre, originalLang: 'AZ_LATIN', order: ++collOrder, status: 'DRAFT' });
    };
    const write = (slug: string, sourceId: string, titleAz: string, coll: string, genre: Genre, spread: number, body: string, year?: number) => {
      const n = (order.get(coll) ?? 0) + 1;
      order.set(coll, n);
      console.log(`    ${slug}  (${body.length} chars)`);
      if (!opts.dryRun) writeWorkMd({
        slug, sourceId, titleAz, authorSlug: cfg.slug, collectionSlug: coll, originalLang: 'AZ_LATIN', scriptDirection: 'LTR',
        genre, year, order: n, sourceNote: readerUrl(book.bibid, spread), status: 'DRAFT',
      }, body);
    };

    works.forEach((w, k) => {
      section = book.sections.find((s) => s.first === w.title) ?? section;
      if (!section) { console.warn(`  Before any section, left out: ${w.title}`); return; }
      // The date printed under a work's end ("*1890*", "*1898-1900*") is its year
      const dated = w.body.match(/\n\*(\d{4})(?:\s*[-–]\s*\d{2,4})?\*$/);
      const year = dated ? Number(dated[1]) : undefined;
      const body = dated ? w.body.slice(0, dated.index).trim() : w.body;
      if (section.pieces) {
        collection(section.collection, section.titleAz, section.genre);
        body.split(/^### (?=\d+$)/m).forEach((piece, n) => {
          const m = piece.match(/^(\d+)\n/);
          if (!m) {
            if (piece.trim()) console.warn(`  Before the first numbered piece, left out: ${piece.slice(0, 60)}`);
            return;
          }
          const title = `${w.title} ${m[1]}`;
          const text = piece.slice(m[0].length).trim();
          // Each piece closes on the paper it ran in: "*“Həyat” qəzeti, 5 oktyabr 1905, №78*"
          const ran = text.match(/\*[^*\n]*\b(1[89]\d\d)\b[^*\n]*\*$/);
          write(unique(shortSlug(`${cfg.slug}-${title}`)), `anl-${book.bibid}-t${k + 1}-${m[1]}`, title,
            section!.collection, section!.genre, w.spread, text, ran ? Number(ran[1]) : undefined);
        });
        return;
      }
      const split = parts(body, section.layout);
      const base = shortSlug(`${cfg.slug}-${w.title}`);
      if (split.length === 1) {
        collection(section.collection, section.titleAz, section.genre);
        write(unique(base), `anl-${book.bibid}-t${k + 1}`, w.title, section.collection, section.genre, w.spread, body, year);
        return;
      }
      // A play in acts: a collection of its own, one work per act
      collection(base, w.title, section.genre);
      split.forEach((part, n) => {
        write(unique(part.title ? shortSlug(`${base}-${part.title}`) : base), `anl-${book.bibid}-t${k + 1}-${n}`,
          part.title ?? w.title, base, section!.genre, w.spread, part.body, year);
      });
    });
    console.log(`  ${works.length} works`);
  });
