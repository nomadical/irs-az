/**
 * Original works from a typeset PDF edition with a text layer (e.g. the National Library's
 * scans of the six-volume Füzuli, anl.az/el/f/fm_e2.pdf).
 *
 * The text comes out one string per page: the page number first, verse lines with footnote
 * markers glued to the last word ("biniş1."), then the page's footnotes as prose lines that
 * start with their number. Headings are set in capitals. There are no blank lines, so
 * stanzas are rebuilt from the form: couplets, or quatrains for rubais and mürəbbes.
 */
import axios from 'axios';
import { execFileSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { extractText, getDocumentProxy } from 'unpdf';
import type { PoemForm } from '../types';
import { fixHomoglyphs, shortSlug } from './wikisource-az';

const RAW_DIR = path.resolve(__dirname, '../../data/raw');

export interface BookSection {
  collectionSlug: string;
  /** Work slugs are `${slugBase}-${n}`, or `slugBase` alone for a section that is one work */
  slugBase: string;
  /** Printed page numbers, inclusive */
  pages: [number, number];
  /** Regex on a heading (in capitals) that starts a new work; other headings stay inside it */
  chapters?: string;
  /** The section is one work with this title, from its first page */
  title?: string;
  /** Regex on lines that head a part without capitals ("2. Həmzə.", a hadith's number) */
  subheadings?: string;
  /** Prose with verse set in it: long lines are wrapped prose, short ones verse */
  prose?: boolean;
  /** Added to each work's position, to place the section after a collection's other works */
  orderFrom?: number;
  form?: PoemForm;
  year?: number;
  /** Headings (regex) whose block is set in quatrains rather than couplets */
  quatrains?: string;
  /** Old slugs of works this section replaces, by the n of the work that now holds them */
  previousSlugs?: Record<string, string[]>;
  /**
   * Regex on the line that parts untitled poems ("* * *"): each starts a work named by its first
   * line, slugged from it like a Wikisource poem (`${authorSlug}-${first line}`)
   */
  separator?: string;
  /** Titles for separated poems whose first line won't do (Arabic script), by n */
  titles?: Record<string, string>;
  /** Verses numbered every few lines in the margin ("15 Rüxü …"): the numbers are dropped */
  verseNumbers?: boolean;
}

export interface BookConfig {
  id: string;
  url: string;
  /** The edition, for the data README's source list */
  citation: string;
  authorSlug: string;
  /** OCR misreadings in headings, fixed before titles are made: "LEVLİ" → "LEYLİ" */
  headingFixes?: Record<string, string>;
  /** Words kept capitalised in titles (stems: "leyli" also covers "Leyliyə") */
  names?: string[];
  /**
   * Pages printed as images, with no text layer, typed from the scan: page number → its lines.
   * "[…]" stands for lines the edition prints in Arabic script as pictures
   */
  pageTexts?: Record<string, string>;
  /** The font has no İ: a capital I before a lowercase letter is read as İ ("Irişdi" → "İrişdi") */
  dotlessCapitalI?: boolean;
  sections: BookSection[];
}

export interface BookWork {
  n: number;
  slug: string;
  sourceId: string;
  titleAz: string;
  body: string;
  page: number;
  previousSlugs?: string[];
  /** Blocks whose verse count doesn't divide into stanzas: a line lost or split by the OCR */
  warnings: string[];
}

/** The PDF, downloaded once into data/raw */
export async function pdfDocument(url: string) {
  if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true });
  const cached = path.join(RAW_DIR, `${crypto.createHash('md5').update(url).digest('hex')}.pdf`);
  if (!fs.existsSync(cached)) {
    console.log(`  GET ${url}`);
    try {
      const resp = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 120_000 });
      fs.writeFileSync(cached, Buffer.from(resp.data));
    } catch (e) {
      // anl.az doesn't send its intermediate certificate. Node won't fetch it; macOS curl
      // does, and still verifies the chain
      const err = e as { code?: string; cause?: { code?: string } };
      if ((err.cause?.code ?? err.code) !== 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') throw e;
      execFileSync('curl', ['-sSfL', '--max-time', '300', '-o', cached, url]);
    }
  }
  return getDocumentProxy(new Uint8Array(fs.readFileSync(cached)));
}

export async function fetchPdfPages(url: string): Promise<string[]> {
  const { text } = await extractText(await pdfDocument(url), { mergePages: false });
  return text;
}

const azLower = (s: string) => s.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
const azUpperFirst = (s: string) =>
  s.charAt(0) === 'i' ? 'İ' + s.slice(1) : s.charAt(0) === 'ı' ? 'I' + s.slice(1) : s.charAt(0).toUpperCase() + s.slice(1);

/** The "və" that joins a two-part title, on a line of its own (OCR sometimes reads it "va") */
const isJoiner = (line: string) => line === 'və' || line === 'va' || line === 'VƏ';

/** A heading line: capitals only, or a joiner */
const isHeading = (line: string) =>
  isJoiner(line) || (/\p{Lu}{2}/u.test(line) && !/\p{Ll}/u.test(line.replace(/\d+$/, '')));

/**
 * Footnote markers glued to a word or quote ("biniş1." → "biniş.", "qürəşi*,"), "ä" misread for
 * "ə" in verse, and Cyrillic look-alikes in Latin words ("оldu")
 */
const clean = (line: string) =>
  fixHomoglyphs(
    line
      .replace(/(\p{L}['’]?|["»”])\d{1,2}(?=[\s.,!?;:"»)]|$)/gu, '$1')
      .replace(/(\p{L})\*+/gu, '$1')
      .replace(/ä/g, 'ə'),
  );

/** Lines the edition prints as pictures (Arabic script), left out where they stood */
const GAP = '[…]';

/** Wrapped prose runs to the margin; verse lines stop well short of it */
const PROSE_WIDTH = 65;

/**
 * Prose with verse set in it. A long line is prose, and so is every line until its paragraph
 * ends on a full stop (or ":", "!", "?"); short lines after that are verse, in stanzas of
 * `size` lines. A short lead-in ending in ":" that would leave the verse a line over goes
 * back to the prose. Wrapped words rejoin: a line ending in "-" continues a hyphenated
 * compound ("nəqşi-" + "səhifeyi" → "nəqşi-səhifeyi").
 */
function proseAndVerse(lines: string[], size: number): string[] {
  const out: string[] = [];
  let paragraph = '';
  let verse: string[] = [];
  const ends = (line: string) => /[.:!?»"”]$/.test(line);
  const flushVerse = () => {
    if (verse.length % size && verse[0].endsWith(':')) out.push(verse.shift()!);
    const stanzas: string[] = [];
    for (let i = 0; i < verse.length; i += size) stanzas.push(verse.slice(i, i + size).join('\n'));
    if (stanzas.length) out.push(stanzas.join('\n\n'));
    verse = [];
  };
  const flushParagraph = () => {
    if (paragraph) out.push(paragraph);
    paragraph = '';
  };
  for (const line of lines) {
    if (line.length >= PROSE_WIDTH || paragraph) {
      flushVerse();
      paragraph = !paragraph ? line : paragraph.endsWith('-') ? paragraph + line : `${paragraph} ${line}`;
      if (line.length < PROSE_WIDTH && ends(line)) flushParagraph();
    } else {
      verse.push(line);
    }
  }
  flushParagraph();
  flushVerse();
  return out;
}

export function titleCase(heading: string, names: string[]): string {
  const words = azLower(heading).split(' ');
  // Names inside compounds too: "qəzəli-leyli" → "qəzəli-Leyli"
  const out = words.map((w) =>
    w
      .split('-')
      .map((part) => {
        const bare = part.replace(/^[("«]/, '');
        return names.some((n) => bare.startsWith(n)) ? part.replace(bare, azUpperFirst(bare)) : part;
      })
      .join('-'),
  );
  return azUpperFirst(out.join(' '));
}

/** Two-line rhyming titles ("…DİR" / "…DİR") read as one sentence with a comma between */
function joinHeading(lines: string[]): string {
  const parts: string[] = [];
  for (const line of lines) {
    if (isJoiner(line)) {
      parts.push('və');
      continue;
    }
    const prev = parts[parts.length - 1];
    if (prev && prev !== 'və' && /D[IİUÜ]R$/.test(prev)) {
      parts[parts.length - 1] = prev + ',';
    }
    parts.push(line);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** Stands in a separated section's token list for the line that parts two poems */
const SEPARATOR = '\u0000separator';

interface Token {
  kind: 'heading' | 'sub' | 'line';
  text: string;
  page: number;
}

function tokens(pages: string[], book: BookConfig, section: BookSection): Token[] {
  const out: Token[] = [];
  const [from, to] = section.pages;
  for (let page = from; page <= to; page++) {
    const lines = (book.pageTexts?.[page] ?? pages[page - 1] ?? '').split('\n').map((l) => l.trim());
    if (/^\d+$/.test(lines[0] ?? '')) lines.shift();
    for (let raw of lines) {
      if (!raw) continue;
      if (section.verseNumbers) raw = raw.replace(/^\d{1,3}\s+(?=\p{Lu})/u, '');
      // Footnotes close the page: "1 Tərcüməsi: …", "* Qüreyşi" (a variant reading), and the
      // prose lines after it
      if (/^\d{1,2}\s+\S/.test(raw) || /^\*\s*\p{L}/u.test(raw)) break;
      let text = clean(raw);
      if (book.dotlessCapitalI) text = text.replace(/(?<!\p{L})I(?=[a-zəüöğçş])/gu, 'İ');
      // Roman numerals number the opening rubais; the stanza break already shows them apart
      if (/^[IVX]+$/.test(text)) continue;
      out.push({ kind: isHeading(text) ? 'heading' : 'line', text, page });
    }
  }
  return out;
}

export function parseSection(pages: string[], book: BookConfig, section: BookSection): BookWork[] {
  const fixes = Object.entries(book.headingFixes ?? {});
  const names = book.names ?? [];
  const fix = (h: string) => fixes.reduce((s, [from, to]) => s.split(from).join(to), h);
  const chapterRe = section.chapters ? new RegExp(section.chapters) : null;
  const quatrainRe = section.quatrains ? new RegExp(section.quatrains) : null;
  const subRe = section.subheadings ? new RegExp(section.subheadings) : null;

  // Consecutive heading lines are one heading
  const items: Token[] = [];
  const separatorRe = section.separator ? new RegExp(section.separator) : null;
  for (const t of tokens(pages, book, section)) {
    if (separatorRe?.test(t.text)) {
      items.push({ ...t, kind: 'heading', text: SEPARATOR });
      continue;
    }
    if (subRe?.test(t.text)) {
      items.push({ ...t, kind: 'sub' });
      continue;
    }
    const last = items[items.length - 1];
    if (t.kind === 'heading' && last?.kind === 'heading') last.text += '\n' + t.text;
    else items.push({ ...t });
  }

  const works: BookWork[] = [];
  let work: BookWork | null = null;
  let block: { heading?: string; sub?: boolean; lines: string[] } = { lines: [] };
  let chapterHeading = '';
  const parts: string[] = [];

  const flushBlock = () => {
    if (!work) return;
    const size = quatrainRe?.test(block.heading ?? chapterHeading) ? 4 : 2;
    if (section.prose) {
      if (block.heading) parts.push(`### ${block.sub ? block.heading : titleCase(joinHeading(block.heading.split('\n')), names)}`);
      parts.push(...proseAndVerse(block.lines, size));
      block = { lines: [] };
      return;
    }
    if (block.heading) parts.push(`### ${block.sub ? block.heading : titleCase(joinHeading(block.heading.split('\n')), names)}`);
    // Stanzas run afresh after each gap, which stands as a paragraph of its own
    let run: string[] = [];
    const flushRun = () => {
      if (run.length % size) {
        work!.warnings.push(`"${block.heading ?? work!.titleAz}": ${run.length} lines from "${run[0].slice(0, 30)}", not in ${size}s`);
      }
      const stanzas: string[] = [];
      for (let i = 0; i < run.length; i += size) stanzas.push(run.slice(i, i + size).join('\n'));
      if (stanzas.length) parts.push(stanzas.join('\n\n'));
      run = [];
    };
    for (const line of block.lines) {
      if (line === GAP) {
        flushRun();
        parts.push(GAP);
      } else run.push(line);
    }
    flushRun();
    block = { lines: [] };
  };
  const flushWork = () => {
    flushBlock();
    if (work) {
      work.body = parts.join('\n\n');
      works.push(work);
    }
    parts.length = 0;
  };

  if (section.title) {
    work = {
      n: 1,
      slug: section.slugBase,
      sourceId: `${book.id}-${section.slugBase}`,
      titleAz: section.title,
      body: '',
      page: section.pages[0],
      previousSlugs: section.previousSlugs?.['1'],
      warnings: [],
    };
  }

  let untitled = false;
  for (const item of items) {
    if (item.kind === 'heading' && item.text === SEPARATOR) {
      flushWork();
      untitled = true;
      continue;
    }
    // In a separated section a heading in capitals names a poem of its own
    const titled = separatorRe && item.kind === 'heading';
    if ((item.kind === 'line' && untitled) || titled) {
      if (titled) flushWork();
      untitled = false;
      const n = works.length + 1;
      const titleAz =
        section.titles?.[String(n)] ??
        (titled ? titleCase(joinHeading(fix(item.text).split('\n')), names) : item.text.replace(/[,.;:]+$/, ''));
      work = {
        n,
        slug: shortSlug(`${book.authorSlug}-${titleAz}`),
        sourceId: `${book.id}-${section.slugBase}-${n}`,
        titleAz,
        body: '',
        page: item.page,
        previousSlugs: section.previousSlugs?.[String(n)],
        warnings: [],
      };
      if (titled) continue;
    }
    if (item.kind === 'line') {
      block.lines.push(item.text);
      continue;
    }
    if (item.kind === 'sub') {
      flushBlock();
      block.heading = fix(item.text);
      block.sub = true;
      continue;
    }
    const heading = fix(item.text);
    if (chapterRe?.test(heading.replace(/\n/g, ' '))) {
      flushWork();
      const n = works.length + 1;
      chapterHeading = heading;
      work = {
        n,
        slug: `${section.slugBase}-${n}`,
        sourceId: `${book.id}-${section.slugBase}-${n}`,
        titleAz: titleCase(joinHeading(heading.split('\n')), names),
        body: '',
        page: item.page,
        previousSlugs: section.previousSlugs?.[String(n)],
        warnings: [],
      };
    } else {
      flushBlock();
      block.heading = heading;
    }
  }
  flushWork();
  return works;
}
