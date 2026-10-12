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

export async function fetchPdfPages(url: string): Promise<string[]> {
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
  const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync(cached)));
  const { text } = await extractText(pdf, { mergePages: false });
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

/** Footnote markers glued to a word or quote ("biniş1." → "biniş."), and "ä" misread for "ə" in verse */
const clean = (line: string) =>
  line
    .replace(/(\p{L}['’]?|["»”])\d{1,2}(?=[\s.,!?;:"»)]|$)/gu, '$1')
    .replace(/ä/g, 'ə');

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

function titleCase(heading: string, names: string[]): string {
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

interface Token {
  kind: 'heading' | 'sub' | 'line';
  text: string;
  page: number;
}

function tokens(pages: string[], [from, to]: [number, number]): Token[] {
  const out: Token[] = [];
  for (let page = from; page <= to; page++) {
    const lines = (pages[page - 1] ?? '').split('\n').map((l) => l.trim());
    if (/^\d+$/.test(lines[0] ?? '')) lines.shift();
    for (const raw of lines) {
      if (!raw) continue;
      // Footnotes close the page: "1 Tərcüməsi: …" and the prose lines after it
      if (/^\d{1,2}\s+\S/.test(raw)) break;
      const text = clean(raw);
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
  for (const t of tokens(pages, section.pages)) {
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
    if (block.lines.length % size) {
      work.warnings.push(`"${block.heading ?? work.titleAz}": ${block.lines.length} lines, not in ${size}s`);
    }
    const stanzas: string[] = [];
    for (let i = 0; i < block.lines.length; i += size) stanzas.push(block.lines.slice(i, i + size).join('\n'));
    if (block.heading) parts.push(`### ${block.sub ? block.heading : titleCase(joinHeading(block.heading.split('\n')), names)}`);
    if (stanzas.length) parts.push(stanzas.join('\n\n'));
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

  for (const item of items) {
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
