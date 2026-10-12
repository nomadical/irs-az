/**
 * Translations scattered through a book of literary history — E. J. W. Gibb's
 * A History of Ottoman Poetry (1900–1909). Each translated poem is headed by a numbered
 * label ("Ghazel. [192]") that indexes the original in the last volume. Which of our
 * works a number translates is decided by hand in the config (the originals' volume is
 * Arabic script its OCR can't read), checked against the works' first lines.
 *
 * Read from Internet Archive's word positions (`_djvu.xml`): the poems are set in smaller
 * type than the prose, couplets are set apart by wider gaps, and footnotes — same small
 * type — are justified to the right margin while verse lines end short.
 */
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { cachedGet, cachedGetJson } from '../utils/http';
import { Vocabulary, cleanParagraph, type OcrStats } from './ocr';

const DATA_DIR = path.resolve(__dirname, '../../data');

export interface AnthologyConfig {
  id: string;
  layout: 'anthology';
  title: string;
  translator: string;
  volumes: { volume: number; archiveId: string; year: number }[];
  /** Letter height (scan pixels) below which a line is the poems' small type; prose is larger */
  verseHeight: number;
  items: { volume: number; number: number; workSlug: string; label: string }[];
  /** Proofreading corrections checked against the scan, as in BookConfig: exact text or a pattern */
  corrections?: ({ from: string; to: string } | { pattern: string; flags?: string; to: string })[];
  /** Proofread against the scan: the translations no longer carry the OCR caveat */
  proofread?: boolean;
}

export interface AnthologyItem {
  workSlug: string;
  number: number;
  volume: number;
  year: number;
  label: string;
  body: string;
  stanzas: number;
  originalStanzas: number;
  opening: string;
  sourceUrl: string;
}

export interface Line {
  page: number;
  x: number;
  right: number;
  y: number;
  height: number;
  text: string;
}

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Every OCR'd line with its page, left and right edges, top, and median letter height */
export function bookLines(xml: string): Line[] {
  const lines: Line[] = [];
  xml.split('<OBJECT ').slice(1).forEach((page, p) => {
    for (const m of page.matchAll(/<LINE>([\s\S]*?)<\/LINE>/g)) {
      const words = [...m[1].matchAll(/<WORD coords="(\d+),(\d+),(\d+),(\d+)"[^>]*>([^<]*)<\/WORD>/g)].map((w) => ({
        x: +w[1],
        bottom: +w[2],
        right: +w[3],
        top: +w[4],
        text: decode(w[5]).trim(),
      }));
      if (!words.length) continue;
      const heights = words.filter((w) => /[a-z]/.test(w.text)).map((w) => w.bottom - w.top);
      lines.push({
        page: p,
        x: words[0].x,
        right: Math.max(...words.map((w) => w.right)),
        y: Math.min(...words.map((w) => w.top)),
        height: heights.length >= 2 ? median(heights) : 0,
        text: words.map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim(),
      });
    }
  });
  return lines;
}

/** Each page's left text edge: where its full-width lines (prose, footnotes) start */
function pageLefts(lines: Line[]): Map<number, number> {
  const lefts = new Map<number, number>();
  for (const l of lines) {
    if (l.right - l.x < 600) continue;
    lefts.set(l.page, Math.min(lefts.get(l.page) ?? Infinity, l.x));
  }
  return lefts;
}

/** The text block's width: prose lines run from the left edge to the right margin */
function blockWidth(lines: Line[], lefts: Map<number, number>, verseHeight: number): number {
  const widths = lines
    .filter((l) => l.height >= verseHeight && l.text.length > 60)
    .map((l) => l.right - (lefts.get(l.page) ?? l.x));
  return median(widths);
}

/** The poem after its numbered label, as stanzas of lines */
function extractPoem(lines: Line[], number: number, verseHeight: number, lefts: Map<number, number>, width: number): string[][] | null {
  const label = new RegExp(`\\[\\s*${number}\\s*[\\])]`);
  const start = lines.findIndex((l) => label.test(l.text));
  if (start < 0) return null;

  const stanzas: Line[][] = [];
  let stanza: Line[] = [];
  let prevY = -1;
  const gaps: number[] = [];
  let notesPage = -1;

  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.page === notesPage) continue;
    // A new chapter ends the poem (its heading would otherwise pass for a running head)
    if (/^CHAPTER\b/i.test(l.text)) break;
    // Page headers and numbers
    if (/^[\divxlc.\s]{1,6}$/i.test(l.text) || (l.height === 0 && /^[A-Z\s.,']+$/.test(l.text))) continue;
    // The next labelled poem ends this one; a prose sentence introducing it ("The following
    // will serve as a specimen…") is a tall line, and goes
    if (/\[\s*\d+\s*[\])]/.test(l.text)) {
      while (stanza.length && stanza[stanza.length - 1].height >= verseHeight) stanza.pop();
      break;
    }

    // Prose and footnotes run the full width of the text block; verse lines end short.
    // The prose resuming is two tall full-width lines in a row: OCR measures the odd verse
    // line tall too
    const fullWidth = (x: Line) => x.right >= (lefts.get(x.page) ?? x.x) + width - 40;
    const next = lines.slice(i + 1).find((x) => x.height > 0 && !/^[\divxlc.\s]{1,6}$/i.test(x.text));
    if (fullWidth(l) && l.height >= verseHeight && next && next.height >= verseHeight && fullWidth(next)) {
      if (stanza.length || stanzas.length) break;
      continue;
    }
    // A footnote opens with its number or mark ("1 The flute…", "* The liver…", or a
    // superscript read as "'" — verse never has a space after a leading apostrophe).
    // Footnotes fill the page bottom, so the rest of the page goes with it
    if (/^(\d{1,2}|[*†‡^'’])\s/.test(l.text)) {
      notesPage = l.page;
      prevY = -1;
      continue;
    }

    const gap = prevY >= 0 ? l.y - prevY : Infinity;
    prevY = l.y;
    const lineGap = median(gaps) || 67;
    if (gap < 150) gaps.push(gap);
    if (stanza.length && gap > lineGap * 1.4) {
      stanzas.push(stanza);
      stanza = [];
    }
    stanza.push(l);
  }
  if (stanza.length) stanzas.push(stanza);
  return stanzas.map((st) => st.map((l) => l.text)).filter((st) => st.length > 0);
}

/** Footnote markers set inline as superscripts: "Form! 2 thou", "gear. *", "thrown.8", "•" */
function stripMarkers(line: string): string {
  return line
    .replace(/\s*[•*†‡]\s*$/, '')
    .replace(/([.,;:!?'’])\d{1,2}(?=\s|$)/g, '$1')
    .replace(/(\S)\s+\d{1,2}(?=\s+[a-z])/g, '$1')
    .replace(/\s+\d{1,2}$/, '')
    .replace(/\s+•\s*/g, ' ')
    .replace(/\s+['’]$/, '') // a superscript mark read as a quote: "retain. '" (real quotes close up)
    .replace(/^"(?=(Tis|Twas|Twere|Twill|Gainst)\b)/, "'") // '"Tis' is 'Tis
    .trim();
}

function workFile(workSlug: string): { couplets: number; singleLines: boolean; stanzaLines: number[] } | null {
  const hit = fs
    .readdirSync(path.join(DATA_DIR, 'works'), { recursive: true, withFileTypes: true })
    .find((e) => e.isFile() && (e.name.endsWith(`-${workSlug}.md`) || e.name === `${workSlug}.md`));
  if (!hit) return null;
  const { content } = matter(fs.readFileSync(path.join(hit.parentPath, hit.name), 'utf-8'));
  const paras = content.trim().split(/\n\s*\n/).filter((p) => p.trim());
  // Some az.wikisource texts put a blank line after every line, not every couplet
  const singleLines = paras.length > 1 && paras.every((p) => !p.includes('\n'));
  const stanzaLines = paras.map((p) => p.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length).filter(Boolean);
  return { couplets: paras.length, singleLines, stanzaLines };
}

export function loadAnthologyConfig(id: string): AnthologyConfig {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config/translations', `${id}.json`), 'utf-8'));
}

export async function planAnthology(
  cfg: AnthologyConfig,
): Promise<{ items: AnthologyItem[]; missing: string[]; ocr: OcrStats; unusedCorrections: string[] }> {
  const ocr: OcrStats = { fixed: 0, unknown: 0, words: 0 };
  const used = new Set<number>();
  const correct = (body: string) =>
    (cfg.corrections ?? []).reduce((text, c, i) => {
      const next = 'from' in c ? text.split(c.from).join(c.to) : text.replace(new RegExp(c.pattern, c.flags ?? 'g'), c.to);
      if (next !== text) used.add(i);
      return next;
    }, body);
  const items: AnthologyItem[] = [];
  const missing: string[] = [];

  for (const vol of cfg.volumes) {
    const meta = await cachedGetJson<{ result: { name: string }[] }>(`https://archive.org/metadata/${vol.archiveId}/files`);
    const file = (suffix: string) => meta.result.find((f) => f.name.endsWith(suffix))?.name;
    const xmlName = file('_djvu.xml');
    const txtName = file('_djvu.txt');
    if (!xmlName || !txtName) throw new Error(`No OCR files in ${vol.archiveId}`);
    const xml = await cachedGet(`https://archive.org/download/${vol.archiveId}/${encodeURIComponent(xmlName)}`);
    const vocab = new Vocabulary(await cachedGet(`https://archive.org/download/${vol.archiveId}/${encodeURIComponent(txtName)}`));
    const lines = bookLines(xml);
    const lefts = pageLefts(lines);
    const width = blockWidth(lines, lefts, cfg.verseHeight);

    for (const item of cfg.items.filter((i) => i.volume === vol.volume)) {
      const work = workFile(item.workSlug);
      const poem = extractPoem(lines, item.number, cfg.verseHeight, lefts, width);
      if (!poem || !work) {
        missing.push(`vol. ${item.volume} [${item.number}] → ${item.workSlug}${work ? '' : ' (work not found)'}`);
        continue;
      }
      const stanzas = poem
        .map((st) => st.map((line) => stripMarkers(cleanParagraph(line, vocab, ocr))).filter(Boolean))
        // A stanza that is only a number is a page number the layout put mid-poem ("102", or "IO2")
        .filter((st) => st.length > 0 && !(st.length === 1 && /^([\d\s.,'’]{1,6}|(?=.*\d)[\dIOl]{2,4})$/.test(st[0])));
      // Match the original's paragraphing so the side-by-side view lines up: the same stanza
      // shape when the line counts agree, or couplets for a couplet poem (a masnavi passage
      // translated as one run of verse)
      const verse = stanzas.flat();
      const total = work.stanzaLines.reduce((a, b) => a + b, 0);
      let blocks = stanzas;
      if (work.singleLines) blocks = verse.map((l) => [l]);
      else if (stanzas.length !== work.couplets && verse.length === total) {
        let k = 0;
        blocks = work.stanzaLines.map((n) => verse.slice(k, (k += n)));
      } else if (stanzas.length !== work.couplets && work.stanzaLines.every((n) => n === 2) && verse.length % 2 === 0) {
        blocks = [];
        for (let k = 0; k < verse.length; k += 2) blocks.push(verse.slice(k, k + 2));
      }
      items.push({
        workSlug: item.workSlug,
        number: item.number,
        volume: item.volume,
        year: vol.year,
        label: item.label,
        body: correct(blocks.map((b) => b.join('\n')).join('\n\n')),
        stanzas: blocks.length,
        originalStanzas: work.couplets,
        opening: blocks[0]?.join(' / ') ?? '',
        sourceUrl: `https://archive.org/details/${vol.archiveId}`,
      });
    }
  }
  const unusedCorrections = (cfg.corrections ?? [])
    .filter((_, i) => !used.has(i))
    .map((c) => ('from' in c ? c.from : `/${c.pattern}/`));
  return { items, missing, ocr, unusedCorrections };
}
