/**
 * The 2004–2005 state reprints in Latin script ("Azərbaycan dilində latın qrafikası ilə kütləvi
 * nəşrlər"), as the National Library serves them: web2.anl.az:81/read/page.php?bibid=N&download=1.
 *
 * Their text layer is set in an old 8-bit Azerbaijani font that puts Latin letters on Cyrillic
 * code points: read as Windows-1252 bytes, decoded as Windows-1251, each Cyrillic letter stands
 * for one Latin one (я = ə, ю = ö, ц = ü, ь = ğ, ы = ı, щ = h, ъ = c, э = g, г = q, й = y).
 *
 * The plain text loses what the layout says, so lines are read with their positions: a taller
 * gap is a stanza break, an indented line starts a paragraph, smaller type is a stage direction
 * or a date, and superscript digits are the editor's glossary marks, whose notes sit below a
 * rule at the foot of the page. The printed page number is the PDF page number.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import { getDocumentProxy } from 'unpdf';
import type { Genre, PoemForm } from '../types';
import { shortSlug } from './wikisource-az';

const RAW_DIR = path.resolve(__dirname, '../../data/raw');

const LETTERS: Record<string, string> = {
  а: 'a', б: 'b', ъ: 'c', ч: 'ç', д: 'd', е: 'e', я: 'ə', ф: 'f', э: 'g', ь: 'ğ', щ: 'h', х: 'x',
  ы: 'ı', и: 'i', ж: 'j', к: 'k', г: 'q', л: 'l', м: 'm', н: 'n', о: 'o', ю: 'ö', п: 'p', р: 'r',
  с: 's', ш: 'ş', т: 't', у: 'u', ц: 'ü', в: 'v', й: 'y', з: 'z',
};
const MAP: Record<string, string> = { ...LETTERS };
for (const [c, l] of Object.entries(LETTERS)) MAP[c.toUpperCase()] = l.toUpperCase();
MAP['И'] = 'İ';

// Windows-1252 code points above 0x7F that are not Latin-1
const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
const CP1251 = new TextDecoder('windows-1251');

/** The font's text as the Latin Azerbaijani it shows */
export function decodeAzFont(s: string): string {
  const bytes = Uint8Array.from([...s].map((ch) => {
    const c = ch.codePointAt(0)!;
    return c < 0x100 ? c : CP1252[c] ?? 0x3f;
  }));
  return [...CP1251.decode(bytes)].map((ch) => MAP[ch] ?? ch).join('');
}

export interface Line {
  page: number;
  y: number;
  x: number;
  /** Type size: 12 headings, 11 text, 9 dates and stage directions */
  size: number;
  text: string;
  /** Vertical distance from the line above on the same page (0 for a page's first line) */
  gap: number;
  /** Where the line ends: a prose line that stops short of the margin ends its paragraph */
  right: number;
}

async function download(url: string): Promise<Buffer> {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const file = path.join(RAW_DIR, `${crypto.createHash('md5').update(url).digest('hex')}.pdf`);
  if (!fs.existsSync(file)) {
    console.log(`  GET ${url}`);
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 600_000 });
    fs.writeFileSync(file, Buffer.from(resp.data));
  }
  return fs.readFileSync(file);
}

const RULE = /^_{5,}$/;

// Some reprints (Lider, 2005) carry real Latin text, but set a few letters from the Cyrillic font
const HOMOGLYPHS: Record<string, string> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', к: 'k', і: 'i', ј: 'j',
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', І: 'I',
};
const fixHomoglyphs = (s: string) => s.replace(/[\u0400-\u04ff]/g, (ch) => HOMOGLYPHS[ch] ?? ch);
// Letters the old font cannot hold: their presence means the text layer is Unicode already
const UNICODE_AZ = /[əƏıİşŞğĞ]/;

/** Every page's body lines, top to bottom: no page numbers, glossary marks or glossary notes */
export async function readReprint(url: string): Promise<Line[][]> {
  const pdf = await getDocumentProxy(new Uint8Array(await download(url)));
  const pages: Line[][] = [];
  let unicode = false;
  for (let n = 1; n <= Math.min(pdf.numPages, 30) && !unicode; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    unicode = (content.items as { str: string }[]).some((i) => UNICODE_AZ.test(i.str ?? ''));
  }
  const decode = unicode ? fixHomoglyphs : decodeAzFont;
  // Where each page's first rule stands alone on its line, -1 for none
  const rules: number[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    const rows = new Map<number, { x: number; size: number; parts: { x: number; w: number; s: string }[] }>();
    for (const item of content.items as { str: string; transform: number[]; height: number; width: number }[]) {
      if (!item.str?.trim()) continue;
      // Superscript glossary marks are set small and raised off the line
      if (item.height < 8 && /^\s*\d+\s*$/.test(item.str)) continue;
      const y = Math.round(item.transform[5]);
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      const row = rows.get(key) ?? { x: Infinity, size: 0, parts: [] };
      row.parts.push({ x: item.transform[4], w: item.width, s: item.str });
      if (!RULE.test(item.str.trim())) {
        row.x = Math.min(row.x, item.transform[4]);
        row.size = Math.max(row.size, Math.round(item.height));
      }
      rows.set(key, row);
    }
    const sorted = [...rows.entries()].sort((a, b) => b[0] - a[0]);
    const lines: Line[] = [];
    let prevY: number | null = null;
    let ruleAt = -1;
    for (const [y, row] of sorted) {
      // Pieces of a line meet without their space; a removed glossary mark leaves a gap too
      const parts = row.parts.sort((a, b) => a.x - b.x);
      let raw = '';
      parts.forEach((part, k) => {
        const prev = parts[k - 1];
        if (prev && part.x - (prev.x + prev.w) > 1.5 && !/\s$/.test(raw) && !/^\s/.test(part.s)) raw += ' ';
        raw += part.s;
      });
      const right = Math.round(Math.max(...parts.filter((q) => !RULE.test(q.s.trim())).map((q) => q.x + q.w)));
      if (RULE.test(raw.trim())) {
        if (ruleAt < 0) ruleAt = lines.length;
        continue;
      }
      const text = decode(raw.replace(/_{5,}/g, '')).replace(/\s+/g, ' ').replace(/ ([,.;:!?»”)])/g, '$1').trim();
      if (!text) continue;
      // The printed page number, centred at the foot
      if (/^\d{1,3}$/.test(text) && y < 90) continue;
      lines.push({ page: n, y, x: Math.round(row.x), size: row.size, text, gap: prevY === null ? 0 : prevY - y, right });
      prevY = y;
    }
    pages.push(lines);
    rules.push(ruleAt);
  }
  // A rule alone on its line opens the glossary notes, unless nearly every page has one: then it is
  // the page's foot ornament (Şərq-Qərb), with a line of text still below it
  const ornament = rules.filter((r) => r >= 0).length > pages.length * 0.6;
  pages.forEach((lines, n) => {
    if (!ornament && rules[n] >= 0) lines.splice(rules[n]);
    // Lider's glossary notes have no rule above them: a gap, then small type to the page's foot,
    // opening "Mozalan – Heyvanları sancan…"
    if (unicode) {
      const sizes = new Map<number, number>();
      for (const l of lines) sizes.set(l.size, (sizes.get(l.size) ?? 0) + 1);
      const body = [...sizes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
      const k = lines.findIndex((l, i) => i > 0 && l.gap > 20 && / – /.test(l.text.slice(0, 80))
        && lines.slice(i).every((m) => m.size < body));
      if (k > 0) lines.splice(k);
    }
  });
  // Sizes below assume text set in 11 (Şaiq); other volumes set it in 9 or 10, headings as much larger
  const count = new Map<number, number>();
  for (const l of pages.flat()) count.set(l.size, (count.get(l.size) ?? 0) + 1);
  const body = [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 11;
  if (body !== 11) for (const l of pages.flat()) l.size += 11 - body;
  return pages;
}

export interface TocEntry {
  section: string;
  title: string;
  page: number;
}

/**
 * The "KİTABDAKILAR" pages at the back: section headings in capitals (or as the config names them:
 * "Komediyalar"), then "Title . . . . 29"; a title too long for one line runs on to the next
 */
export function readToc(pages: Line[][], sections: string[] = []): TocEntry[] {
  const start = pages.findIndex((p) => p.some((l) => /^(KİTABDAKILAR|MÜNDƏRİCAT)$/.test(l.text)));
  if (start < 0) return [];
  const entries: TocEntry[] = [];
  let section = '';
  let pending = '';
  for (const page of pages.slice(start)) {
    for (const l of page) {
      const m = l.text.match(/^(.*?)\s*(?:[.…]\s*){3,}\s*(\d+)$/);
      if (m) {
        entries.push({ section, title: `${pending} ${m[1]}`.trim(), page: Number(m[2]) });
        pending = '';
      } else if (sections.includes(l.text) || (l.text === l.text.toLocaleUpperCase('az') && /\p{L}{3}/u.test(l.text) && !/KİTABDAKILAR|MÜNDƏRİCAT/.test(l.text))) {
        if (entries.length && /CİLD|BAKI|PRESS/.test(l.text)) return entries;
        section = l.text;
        pending = '';
      } else if (entries.length || section) {
        pending = `${pending} ${l.text}`.trim();
      }
    }
  }
  return entries;
}

/** Letters only, Azerbaijani ones folded: the contents and the headings spell some names apart ("Simurğ", "SİMÜRĞ") */
const fold = (s: string) =>
  s.toLocaleLowerCase('az').replace(/[^\p{L}]/gu, '')
    .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c');

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const STARS = /^\*(\s*\*)+$/;
/** A heading: capitals throughout, in the text's size or larger */
// Nearly all capitals passes too: a quoted title keeps its lowercase suffix ("“KƏMALÜDDÖVLƏ MƏKTUBLARI”nın ÜZÜNÜ")
const capitals = (t: string) => {
  const letters = t.match(/\p{L}/gu) ?? [];
  return letters.length >= 2 && letters.filter((c) => c === c.toLocaleUpperCase('az')).length >= letters.length * 0.8;
};
const isHeading = (l: Line) => l.size >= 11 && /\p{L}{2}/u.test(l.text) && (l.text === l.text.toLocaleUpperCase('az') || capitals(l.text));

/** Whether a heading run spells the title: exactly, as a shortened form, or but for a misprint */
function sameTitle(got: string, want: string): boolean {
  if (got === want) return true;
  if (want.length >= 5 && (got.startsWith(want) || want.startsWith(got)) && Math.min(got.length, want.length) >= 5) return true;
  return want.length >= 6 && distance(got, want) <= Math.max(1, Math.floor(want.length / 5));
}

export interface Located extends TocEntry {
  /** Where the work starts: page index (0-based), its heading's first line and how many lines it has */
  at: { page: number; line: number; lines: number } | null;
}

function find(pages: Line[][], e: TocEntry, p: number, heading?: string, taken = new Set<string>()): Located['at'] {
  const page = pages[p];
  if (!page) return null;
  const want = fold(heading ?? e.title);
  for (let i = 0; i < page.length; i++) {
    if (taken.has(`${p}:${i}`)) continue;
    // An untitled poem: "* * *", then its first line, which the contents use as its title
    if (STARS.test(page[i].text)) {
      const first = page[i + 1] && fold(page[i + 1].text);
      const n = Math.min(24, want.length);
      if (first && distance(first.slice(0, n), want.slice(0, n)) <= 2) return { page: p, line: i, lines: 1 };
      continue;
    }
    if (!isHeading(page[i])) continue;
    // The longest run of heading lines that still spells the title: "HAMIMIZ BİR GÜNƏŞİN" alone
    // is a prefix of "Hamımız bir günəşin zərrəsiyik", and its second line belongs to it too
    // Lines past what the title spells are a subtitle ("TƏQDİM ETDİYİM RƏSMİMİN ALTINA") and stay
    let got = '';
    let best = 0;
    for (let k = i; k < Math.min(page.length, i + 4) && isHeading(page[k]); k++) {
      got += fold(page[k].text);
      if (sameTitle(got, want) && got.length <= want.length + 3) best = k - i + 1;
      else if (best) break;
    }
    if (best) return { page: p, line: i, lines: best };
  }
  return null;
}

/**
 * Each contents entry's heading, near its page first (contents pages misprint a few by a page
 * or two), then anywhere after the entry before it (one misprints 487 as 587).
 */
export function locate(pages: Line[][], toc: TocEntry[], headings: Record<string, string> = {}): Located[] {
  const out: Located[] = [];
  let after = 0;
  // A heading an entry took is not another's: "Təcnisi-digər" would take "TƏCNİS" as its prefix
  const taken = new Set<string>();
  toc.forEach((e, k) => {
    const heading = headings[`${e.title}@${e.page}`] ?? headings[e.title];
    let at: Located['at'] = null;
    for (const delta of [0, -1, 1, -2, 2, -3, 3]) {
      const p = e.page - 1 + delta;
      if (p < after) continue;
      at = find(pages, e, p, heading, taken);
      if (at) break;
    }
    // Not past the next entry's page, or a heading a later work shares ("İKİNCİ MƏKTUB") takes it
    const next = toc.slice(k + 1).find((n) => n.page >= e.page)?.page ?? pages.length;
    for (let p = after; !at && p < Math.min(pages.length, next + 3); p++) at = find(pages, e, p, heading, taken);
    if (at) {
      after = at.page;
      taken.add(`${at.page}:${at.line}`);
    }
    out.push({ ...e, at });
  });
  return out;
}

export type Layout = 'verse' | 'prose' | 'play';

const YEAR = /^(\d{4}(\s*[-–]\s*\d{2,4})?|\d{1,2}\s+\p{L}+\s+\d{4}|\p{L}+,?\s+\d{4})\.?$/u;
const ROMAN = /^[IVXLC]+\.?$/;
// "G o d u n o v." – speakers' names are set letter-spaced
const SPEAKER = /^((?:\p{L}\s){2,}\p{L}(?:\s+(?:\p{L}\s)+\p{L})*)\s*(?=[.(:,])/u;
/** "BİRİNCİ PƏRDƏ" → "Birinci pərdə" */
const sentence = (s: string) => {
  // "İ Ş T İ R A K  E D Ə N L Ə R" → "İştirak edənlər"
  const t = /^(\p{L}\s+)+\p{L}$/u.test(s) ? s.split(/\s{2,}/).map((w) => w.replace(/\s/g, '')).join(' ') : s;
  const out = t.charAt(0) + t.slice(1).toLocaleLowerCase('az');
  // Letter-spaced words are spaced apart no wider than letters: the cast list's heading
  return out.replace(/^İştirakedən(şəxslər|lər)$/, (_, w) => `İştirak edən${w === 'lər' ? 'lər' : ' şəxslər'}`);
};
const unspace = (s: string) => s.split(/\s{2,}|\s(?=\p{Lu})/u).map((w) => w.replace(/\s/g, '')).join(' ');

export interface WorkText {
  body: string;
  year?: number;
  /** Lines in small type right under the heading: a dedication, "Üç pərdəli mənzum pyes" */
  note?: string;
}

/**
 * A work's lines as Markdown. Verse keeps its lines, a taller gap between them a stanza break.
 * Prose joins a paragraph's lines into one (the renderer keeps single line breaks), a paragraph
 * starting at an indent or a dash; a short line inside one keeps its break, so verse quoted in a
 * story stays verse. Small type is a date, which goes to the frontmatter, or a stage direction.
 */
export function workText(lines: Line[], layout: Layout): WorkText {
  const out: string[] = [];
  let year: number | undefined;
  let note: string | undefined;
  const lineGap = 13;
  // Each page's text margin, for telling an indented first line
  const margin = new Map<number, number>();
  const edge = new Map<number, number>();
  for (const l of lines) {
    if (l.size < 11) continue;
    margin.set(l.page, Math.min(margin.get(l.page) ?? Infinity, l.x));
    edge.set(l.page, Math.max(edge.get(l.page) ?? 0, l.right));
  }
  const full = (l: Line) => l.right >= (edge.get(l.page) ?? l.right) - 12;
  // A play's speakers, from their letter-spaced names; a name the typesetter forgot to space
  // ("Qodunov. Xeyr…") still opens a speech
  const speakers = new Set<string>();
  if (layout === 'play') for (const l of lines) {
    const m = l.text.match(SPEAKER);
    if (m) speakers.add(unspace(m[1]));
  }
  const plainSpeaker = (text: string) =>
    [...speakers].find((n) => text.startsWith(n) && /^[.( ]/.test(text.slice(n.length)));

  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(para.join(''));
    para = [];
  };
  const blank = () => {
    flush();
    if (out.length && out[out.length - 1] !== '') out.push('');
  };

  lines.forEach((l, i) => {
    let text = l.text;
    // A play spaces its people's names out wherever they stand: the cast list, stage directions
    if (layout === 'play' && (!SPEAKER.test(text) || l.size <= 10)) text = text.replace(/(?<![\p{L}])(?:\p{L} ){2,}\p{L}(?![\p{L}])/gu, (m) => m.replace(/ /g, ''));
    // "Ə Ş X A S", the cast list's heading, spaced the same way
    if (/^(\p{Lu} )+\p{Lu}$/u.test(l.text)) {
      blank();
      out.push(`### ${sentence(l.text.replace(/ /g, ''))}`);
      blank();
      return;
    }
    if (l.size <= 10) {
      if (YEAR.test(text)) {
        const y = text.match(/\d{4}/)![0];
        year ??= Number(y);
        // Several dated parts: the date stays with its part
        if (i < lines.length - 2) { blank(); out.push(`*${text}*`); blank(); }
        return;
      }
      // Small capitals: a scene's heading, or the cast list's letter-spaced one ("İ Ş T İ R A K …")
      if (text === text.toLocaleUpperCase('az') && /\p{L}{2}|(\p{L} ){3}/u.test(text)) {
        blank();
        out.push(`### ${sentence(text)}`);
        blank();
        return;
      }
      if (out.length === 0 && para.length === 0 && i < 3) { note = note ? `${note} ${text}` : text; return; }
      // Small type in a run is one block: verse quoted in a story, a long stage direction
      const prevSmall = i > 0 && lines[i - 1].size <= 10 && !YEAR.test(lines[i - 1].text) && para.length === 0
        && out.length > 0 && out[out.length - 1].startsWith('*');
      if (prevSmall && l.gap <= lineGap * 1.4) flush();
      else blank();
      out.push(`*${text.replace(/^\*+|\*+$/g, '')}*`);
      return;
    }
    if (STARS.test(text)) { blank(); out.push('* * *'); blank(); return; }
    // Capitals right under the title are its subtitle
    if (isHeading(l) && out.length === 0 && para.length === 0 && !ROMAN.test(text) && !/PƏRDƏ|FƏSİL|ŞƏKİL|SƏHNƏ/.test(text)) {
      note = note ? `${note} ${text}` : text;
      return;
    }
    if (isHeading(l) || ROMAN.test(text)) { blank(); out.push(`### ${ROMAN.test(text) ? text : sentence(text)}`); blank(); return; }

    const newBlock = l.gap > lineGap * 1.5;
    if (layout === 'verse') {
      if (newBlock) blank();
      flush();
      out.push(text);
      return;
    }
    const indented = l.x >= (margin.get(l.page) ?? l.x) + 8;
    const plain = layout === 'play' && !SPEAKER.test(text) ? plainSpeaker(text) : undefined;
    if (plain) text = `**${plain}**${text.slice(plain.length)}`;
    const speaker = (layout === 'play' && SPEAKER.test(text)) || !!plain;
    if (speaker && !plain) text = text.replace(SPEAKER, (m) => `**${unspace(m)}**`).replace(/^(\*\*[^*]+\*\*)(?=\()/, '$1 ').replace(/^(\*\*[^*]+\*\*[^\p{L}]*?[.)])(?=\p{L})/u, '$1 ');
    if (newBlock || indented || speaker || para.length === 0) {
      // A new paragraph or speech: a blank line, as Markdown wants between paragraphs
      blank();
      para.push(text);
      return;
    }
    const prev = para[para.length - 1];
    const above = lines[i - 1];
    if (above && above.page === l.page && !full(above) && !/-$/.test(prev)) {
      // A short line before this one: verse, or a paragraph's end the indent missed
      flush();
      para.push(text);
    } else if (/\p{L}-$/u.test(prev) && /^\p{Ll}/u.test(text)) {
      // A word broken at the margin joins up; a doubled one ("əsnəyə-əsnəyə") keeps its hyphen
      const before = prev.match(/(\p{L}+)-$/u)![1].toLocaleLowerCase('az');
      const doubled = before.length >= 3 && text.toLocaleLowerCase('az').startsWith(before.slice(0, 3));
      if (!doubled) para[para.length - 1] = prev.slice(0, -1);
      para.push(text);
    } else {
      para.push(' ' + text);
    }
  });
  flush();
  const body = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { body, year, note };
}

/** The lines of each located work, from after its heading to the next work's heading */
export function workLines(pages: Line[][], located: Located[]): Line[][] {
  const flat: { p: number; i: number; l: Line }[] = [];
  pages.forEach((page, p) => page.forEach((l, i) => flat.push({ p, i, l })));
  const index = (at: { page: number; line: number }) => flat.findIndex((f) => f.p === at.page && f.i === at.line);
  // A work runs to the next heading on the page, whatever order the contents list them in
  const starts = located.filter((e) => e.at).map((e) => index(e.at!)).sort((a, b) => a - b);
  const tocStart = pages.findIndex((pg) => pg.some((l) => /^(KİTABDAKILAR|MÜNDƏRİCAT)$/.test(l.text)));
  const tocAt = flat.findIndex((f) => f.p === tocStart);
  return located.map((e) => {
    if (!e.at) return [];
    const from = index(e.at);
    const end = starts.find((s) => s > from) ?? (tocAt < 0 ? flat.length : tocAt);
    const own = flat.slice(from + e.at.lines, end).map((f) => f.l);
    // A section heading of the book ("CÜMHURİYYƏT DÖVRÜ") ends up after the work before it
    while (own.length && isHeading(own[own.length - 1])) own.pop();
    return own;
  });
}

// ── Planning: contents entries → collections and works ──


export interface ReprintSection {
  /** Collection for the section's works; a work split into parts gets a collection of its own */
  collection: string;
  titleAz: string;
  genre: Genre;
  form?: PoemForm;
  layout: Layout;
  /** Number titles the section repeats, in book order: a column's pieces ("Ordan-burdan 1", "Ordan-burdan 2") */
  number?: boolean;
}

export interface ReprintVolume {
  /** The National Library reader's book id: web2.anl.az:81/read/page.php?bibid=N */
  bibid: number;
  /** Contents section heading ("HEKAYƏLƏR") → where its works go; sections not listed are left out */
  sections: Record<string, ReprintSection>;
  /** Contents title → the heading as printed, where the two differ beyond a misprint ("title@page" for a repeated title) */
  headings?: Record<string, string>;
  /** Contents titles to leave out ("title@page" for a repeated one): already on the site from another source */
  skip?: string[];
}

export interface PlannedReprintWork {
  slug: string;
  sourceId: string;
  titleAz: string;
  collectionSlug: string;
  genre: Genre;
  form?: PoemForm;
  year?: number;
  order: number;
  sourceNote: string;
  body: string;
}

export interface PlannedReprintCollection {
  slug: string;
  titleAz: string;
  genre: Genre;
  year?: number;
  order: number;
}

const readerUrl = (bibid: number, page?: number) =>
  `http://web2.anl.az:81/read/page.php?bibid=${bibid}${page ? `&pno=${page}` : ''}`;

// A glossary mark the typesetter set full size: a digit or two glued to a word's last letter
// Şərq-Qərb marks a note with an asterisk before the word ("və *Yengi Dünya"); an italic line opens at its start
const stripMarks = (body: string) => body
  .replace(/(\p{Ll})\d{1,2}(?=[\s,.;:!?»”)…]|$)/gmu, '$1')
  .replace(/(?<=[ \t“"(«])\*(?=\p{L})/gu, '');

/** Acts of a play, chapters of a novel: the headings a long work is cut at */
// Lider's plays are in "məclis" (acts) and "şəkil" (scenes); a bare "Pərdə" is the curtain, not an act
const PART = /^### (.+ (pərdə|fəsil|məclis)|.+ şəkil|[IVXLC]+\.?)$/i;
const SPLIT_PROSE = 40_000;

export function parts(body: string, layout: Layout): { title: string | null; body: string }[] {
  const lines = body.split('\n');
  const heads = lines.map((l, i) => (PART.test(l) ? i : -1)).filter((i) => i >= 0);
  // Acts always; chapters only when the work is long. Numbered parts inside chapters stay inside
  const byChapter = heads.filter((i) => /fəsil|pərdə|məclis/i.test(lines[i]));
  const byScene = heads.filter((i) => /şəkil$/i.test(lines[i]));
  // Acts that open with their own cast list, when scenes inside them share the word ("Ağa Məhəmməd
  // şah Qacar": "İkinci məclis", its cast, then its own "Əvvəlinci məclis")
  const cast = (i: number) => /^### (Əhli-məcl[iı]s|İştirak edənlər|Əşxas)/i.test(lines.slice(i + 1).find((l) => l.trim()) ?? '');
  const byCast = byChapter.filter(cast);
  const acts = byCast.length >= 2 ? byCast : byChapter;
  const cuts = acts.length >= 2 ? acts : byScene.length >= 2 ? byScene : heads.length >= 2 ? heads : [];
  if (cuts.length < 2 || (layout !== 'play' && body.length < SPLIT_PROSE)) return [{ title: null, body }];
  const out: { title: string | null; body: string }[] = [];
  const head = lines.slice(0, cuts[0]).join('\n').trim();
  if (head) out.push({ title: null, body: head });
  cuts.forEach((c, k) => {
    const title = lines[c].replace(/^### /, '');
    const named = ROMAN.test(title) ? title.replace(/\.$/, '') : sentence(title);
    out.push({ title: named, body: lines.slice(c + 1, cuts[k + 1]).join('\n').trim() });
  });
  // An act's heading straight above its first scene's: one part, "Üçüncü məclis, birinci pərdə"
  for (let k = out.length - 2; k >= 0; k--) {
    if (out[k].body || !out[k].title || !out[k + 1].title) continue;
    out[k + 1].title = `${out[k].title}, ${out[k + 1].title!.toLocaleLowerCase('az')}`;
    out.splice(k, 1);
  }
  return out;
}

export async function planReprint(authorSlug: string, volumes: ReprintVolume[]) {
  const collections: PlannedReprintCollection[] = [];
  const works: PlannedReprintWork[] = [];
  const used = new Set<string>();
  const unique = (base: string) => {
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    return slug;
  };
  const collSlugs = new Set<string>();
  const collSlug = (base: string) => {
    let slug = base;
    for (let n = 2; collSlugs.has(slug); n++) slug = `${base}-${n}`;
    collSlugs.add(slug);
    return slug;
  };
  const collection = (c: Omit<PlannedReprintCollection, 'order'>) => {
    if (!collections.some((x) => x.slug === c.slug)) collections.push({ ...c, order: collections.length + 1 });
    return c.slug;
  };

  for (const vol of volumes) {
    const pages = await readReprint(`${readerUrl(vol.bibid)}&download=1`);
    // No Azerbaijani word triples a letter: the contents' misprint ("haqqqında")
    const located = locate(pages, readToc(pages, Object.keys(vol.sections)), vol.headings)
      .map((e) => ({ ...e, title: e.title.replace(/(\p{L})\1\1/gu, '$1$1') }));
    const lines = workLines(pages, located);
    // How often each section repeats a title, and how many of each are numbered so far
    const repeats = new Map<string, number>();
    for (const e of located) if (vol.sections[e.section]?.number) repeats.set(`${e.section}\n${e.title}`, (repeats.get(`${e.section}\n${e.title}`) ?? 0) + 1);
    const seen = new Map<string, number>();
    located.forEach((e, k) => {
      const section = vol.sections[e.section];
      if (!section || vol.skip?.includes(e.title) || vol.skip?.includes(`${e.title}@${e.page}`)) return;
      const key = `${e.section}\n${e.title}`;
      if (section.number && (repeats.get(key) ?? 0) > 1) {
        seen.set(key, (seen.get(key) ?? 0) + 1);
        e = { ...e, title: `${e.title} ${seen.get(key)}` };
      }
      if (!e.at) {
        console.warn(`  ${e.title} (p. ${e.page}): heading not found, left out`);
        return;
      }
      const text = workText(lines[k], section.layout);
      const body = stripMarks(text.note ? `*${text.note}*\n\n${text.body}` : text.body)
        .replace(/^### Pərdə\.?$/gm, '*Pərdə*')
        .replace(/^(### .*)məclıs/gm, '$1məclis')
        .replace(/^(### [^\s-]+?)(pərdə|məclis|şəkil)$/gm, '$1 $2');
      const sourceNote = readerUrl(vol.bibid, e.at.page + 1);
      const split = parts(body, section.layout);
      const base = shortSlug(`${authorSlug}-${e.title}`);
      if (split.length === 1) {
        works.push({
          slug: unique(base), sourceId: `anl-${vol.bibid}-${k + 1}`, titleAz: e.title,
          collectionSlug: collection({ slug: section.collection, titleAz: section.titleAz, genre: section.genre }),
          genre: section.genre, form: section.form, year: text.year, order: works.length + 1, sourceNote, body,
        });
        return;
      }
      // A play in acts, a novel in chapters: a collection of its own, one work per part
      // A poem of the same name may hold the plain slug ("Vətən"): the play's says what it is
      const own = used.has(base) ? `${base}-${section.genre === 'PLAY' ? 'pyes' : 'roman'}` : base;
      const coll = collection({ slug: collSlug(own), titleAz: e.title, genre: section.genre, year: text.year });
      split.forEach((part, n) => {
        works.push({
          slug: unique(part.title ? shortSlug(`${coll}-${part.title}`) : coll),
          sourceId: `anl-${vol.bibid}-${k + 1}-${n}`,
          titleAz: part.title ?? e.title,
          collectionSlug: coll, genre: section.genre, form: section.form, year: text.year,
          order: works.length + 1, sourceNote, body: part.body,
        });
      });
    });
  }
  return { collections, works };
}
