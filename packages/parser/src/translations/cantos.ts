/**
 * Layout parser for translations printed canto by canto with numbered couplets and
 * per-page footnotes — H. Wilberforce Clarke's Sikandar Nama (1881).
 *
 * Works from Internet Archive's word-position file (`_djvu.xml`) rather than the plain
 * OCR text, because the page layout says what the text can't:
 *   - footnotes are set in smaller type, so their letters are shorter;
 *   - each half-line starts at the page's left edge; a wrapped continuation is indented;
 *   - couplets are separated by a wider gap than the lines within them;
 *   - margin numbers (every fifth couplet, and the first on a page) sit left of the edge.
 */

import { similarity } from './ocr';

const ROMAN_VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };

// "CANTO II." — OCR spaces the numeral out ("CANTO X X 1 1 1 ."), reads I as l, 1, J or T,
// and the full stop as a comma
const CANTO_START = /^CANTO\s+((?:[IVXLCJlT1]\s*)+)[.,]?\s*$/;

function romanToInt(raw: string): number {
  const s = raw.replace(/\s/g, '').replace(/[lJT1]/g, 'I');
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN_VALUES[s[i]] ?? 0;
    const next = ROMAN_VALUES[s[i + 1]] ?? 0;
    n += v < next ? -v : v;
  }
  return n;
}

export interface Canto {
  number: number;
  title: string;
  couplets: string[][]; // [line 1, line 2], raw (uncleaned) text
}

interface Line {
  x: number; // left edge
  y: number; // top
  height: number; // median height of lowercase words: tells footnotes from verse
  text: string;
}

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Lines of one page, in reading order */
function pageLines(page: string): Line[] {
  const lines: Line[] = [];
  for (const m of page.matchAll(/<LINE>([\s\S]*?)<\/LINE>/g)) {
    const words: { x: number; top: number; bottom: number; text: string }[] = [];
    for (const w of m[1].matchAll(/<WORD coords="(\d+),(\d+),(\d+),(\d+)"[^>]*>([^<]*)<\/WORD>/g)) {
      words.push({ x: +w[1], bottom: +w[2], top: +w[4], text: decode(w[5]).trim() });
    }
    if (!words.length) continue;
    const heights = words.filter((w) => /[a-z]/.test(w.text)).map((w) => w.bottom - w.top);
    // Fewer than two lowercase words give no reliable height
    lines.push({
      x: words[0].x,
      y: Math.min(...words.map((w) => w.top)),
      height: heights.length >= 2 ? median(heights) : 0,
      text: words.map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim(),
    });
  }
  return lines;
}

/** OCR renderings of margin numbers: "i" (1), "e" (5), "is" (15), "so" (50) … */
const MARGIN = /^(\d{1,3}|i|e|is|so|io|lo|3\(>)\s+/;

/**
 * runningHeads: page headers as printed ("THE SIKANDAR NAMA,E BARA"), matched loosely since
 * OCR mangles them ("THE SIKANDAE NAMA,E BAEA"); any other line starting with CANTO is a
 * header too ("CANTO I.J INVOCATION. 11"). firstCanto: where canto I begins when the book
 * prints no "CANTO I." line.
 */
export function parseCantos(
  xml: string,
  runningHeads: string[],
  firstCanto?: RegExp,
  /** Letter height (scan pixels) below which a line is footnote type; Clarke: notes ~35, verse 44+ */
  noteHeight = 40,
): { cantos: Canto[]; skippedNotes: number } {
  const cantos: Canto[] = [];
  let current: { number: number; title: string[]; couplets: string[][]; started: boolean } | null = null;
  let skippedNotes = 0;

  const finish = () => {
    if (current) cantos.push({ number: current.number, title: current.title.join(' '), couplets: current.couplets });
  };

  for (const page of xml.split('<OBJECT ').slice(1)) {
    const all = pageLines(page);
    const small = (l?: Line) => !!l && l.height > 0 && l.height < noteHeight;
    // The page's left text edge: the most common start of verse lines, to the nearest 20px
    // (margin numbers stand further left, wrapped lines are indented)
    // The page's left text edge: the leftmost start shared by at least two verse lines.
    // Margin-number lines stand further left and are left out; on a page where every
    // half-line wraps, indented lines are as common as edge lines, so "leftmost", not "most common"
    const starts = new Map<number, number>();
    for (const l of all) {
      if (l.height < noteHeight || /^\d/.test(l.text)) continue;
      const k = Math.round(l.x / 20);
      starts.set(k, (starts.get(k) ?? 0) + 1);
    }
    const shared = [...starts].filter(([, n]) => n >= 2).map(([k]) => k);
    const edge = 20 * (shared.length ? Math.min(...shared) : Math.min(...starts.keys()));

    let inNotes = false;
    let prevY = -1;
    const gaps: number[] = [];
    let couplet: string[] | null = null;
    const closeCouplet = () => {
      if (current && couplet?.length) current.couplets.push(couplet);
      couplet = null;
    };

    for (let i = 0; i < all.length; i++) {
      const line = all[i];
      const t = line.text;

      const canto = t.match(CANTO_START);
      const first: boolean = !cantos.length && current === null && !!firstCanto?.test(t);
      if (canto || first) {
        closeCouplet();
        finish();
        // Cantos run in order; a number that doesn't follow on is misread ("ILV" for XLV)
        const prevNumber = cantos.length ? cantos[cantos.length - 1].number : 0;
        const read = canto ? romanToInt(canto[1]) : 1;
        const number = read === prevNumber + 1 || read === prevNumber + 2 ? read : prevNumber + 1;
        current = { number, title: first ? [t] : [], couplets: [], started: false };
        prevY = -1;
        // A canto can begin mid-page, below the previous canto's footnotes
        inNotes = false;
        continue;
      }
      const isHeader =
        /^[CO0]ANTO\b/i.test(t) ||
        /^[\dIVXLC.\s]{1,6}$/.test(t) ||
        runningHeads.some((h) => similarity(t.replace(/\[.*$/, ''), h) >= 0.6);
      if (isHeader) continue;
      if (!current) continue;

      // Footnotes: smaller type from here to the page bottom. Two small lines in a row (lines
      // too short to measure don't count either way), so one odd line can't trigger it
      const nextMeasured = all.slice(i + 1).find((l) => l.height > 0);
      if (!inNotes && current.started && small(line) && (!nextMeasured || small(nextMeasured))) inNotes = true;
      if (inNotes) {
        skippedNotes++;
        continue;
      }

      // Before couplet 1 comes the title: centred, or a full-width line or two up to its
      // closing full stop
      if (!current.started) {
        const titleOpen = !/[.!]\s*$/.test(current.title[current.title.length - 1] ?? '');
        const firstCouplet = /^(1|i)\s/.test(t) && line.x < edge - 20;
        if (!firstCouplet && (line.x > edge + 100 || (titleOpen && current.title.length < 3))) {
          current.title.push(t);
          continue;
        }
        current.started = true;
      }

      const atMargin = line.x < edge - 20;
      const m = t.match(MARGIN);
      const text = (m && atMargin ? t.slice(m[0].length) : t).replace(/^[•·■]\s*/, '');
      const gap = prevY >= 0 ? line.y - prevY : Infinity;
      prevY = line.y;
      const lineGap = median(gaps) || 75;
      if (gap < 200) gaps.push(gap);

      if (line.x > edge + 60 && couplet) {
        // An indented line wraps the current half-line
        const last = couplet.length - 1;
        couplet[last] = /-$/.test(couplet[last]) ? couplet[last] + '\n' + text : couplet[last] + ' ' + text;
      } else if (!couplet || gap > lineGap * 1.45 || couplet.length >= 2 || atMargin) {
        // A wider gap or a margin number starts a new couplet
        closeCouplet();
        couplet = [text];
      } else {
        couplet.push(text);
      }
    }
    closeCouplet();
  }
  finish();

  // A couplet broken by a page end: its halves arrive as two one-line couplets
  for (const c of cantos) {
    const joined: string[][] = [];
    for (const cp of c.couplets) {
      const prev = joined[joined.length - 1];
      if (prev && prev.length === 1 && cp.length === 1) prev.push(cp[0]);
      else joined.push([...cp]);
    }
    c.couplets = joined;
  }
  return { cantos, skippedNotes };
}
