/**
 * A verse translation printed as one poem in the translator's own sections, cut by hand into
 * our works: James Atkinson's Laili and Majnun (1836), an abridged paraphrase of Nizami.
 * The config names, for each work, the English line its rendering starts with; the text in
 * between goes to the work before. Works the translator skipped are simply not named.
 *
 * Read from Internet Archive's word positions (`_djvu.xml`): footnotes are set in smaller
 * type than the verse, and a line too long for the measure carries on indented below it.
 */
import * as fs from 'fs';
import * as path from 'path';
import { cachedGet, cachedGetJson } from '../utils/http';
import { bookLines, type Line } from './anthology';

const CONFIG_DIR = path.resolve(__dirname, '../../data/config/translations');

export interface SplitConfig {
  id: string;
  layout: 'split';
  archiveId: string;
  title: string;
  translator: string;
  year: number;
  translatorNote?: string;
  workSlugBase: string;
  /** The translation's language (EN unless stated) */
  language?: 'EN' | 'RU' | 'AZ_LATIN';
  /** Letter height (scan pixels) below which a line is a footnote */
  noteHeight: number;
  /** The poem's first and last lines, as printed */
  first: string;
  last: string;
  /** Page headers ("THE LOVES OF", "LAILI AND MAJNUN 3"), as a pattern */
  runningHeads: string;
  /** Work number → the English line its rendering starts with */
  starts: Record<string, string>;
  /** Proofreading corrections, checked against the scan: exact text or a pattern */
  corrections?: ({ from: string; to: string } | { pattern: string; flags?: string; to: string })[];
  /** Lines in capitals are headings and running heads, not verse */
  dropCaps?: boolean;
  /**
   * An editor's prose set between the verse (summaries of omitted chapters): its lines start
   * left of `left`, and its first, indented line runs out to `right`. A verse line can run that
   * far too, so the right edge only counts right after a heading or another prose line.
   * Each dropped passage leaves a "[…]" between the verse on either side.
   */
  prose?: { left: number; right: number };
  /** Opening lines of the translator's three-line rhymes, kept together among the couplets */
  triplets?: string[];
  /**
   * Read the plain OCR text (`_djvu.txt`) instead of word positions, for items whose `_djvu.xml` isn't
   * DjVu's own: no geometry, so no prose or footnote detection; pages are counted by the page numbers
   * printed on lines of their own
   */
  plainText?: boolean;
  /** Known OCR habits of the scan to undo before corrections: "az" for Azerbaijani Latin text (see azOcr) */
  ocr?: 'az';
  /** Every page checked against the scan: the works go out published */
  proofread?: boolean;
}

/** Cyrillic letters the OCR reads for Latin ones in Azerbaijani text, where real Cyrillic never occurs */
const AZ_CYRILLIC: Record<string, string> = {
  а: 'a', в: 'v', г: 'r', е: 'e', з: 'z', и: 'u', к: 'k', м: 'm', н: 'h', о: 'o', п: 'n', р: 'p', с: 'c', т: 'm',
  у: 'y', х: 'x', ь: 'b', ш: 'ş', ч: 'ç', ә: 'ə', һ: 'h', і: 'i', ј: 'j', ү: 'ü', ө: 'ö', ғ: 'ğ',
  А: 'A', В: 'B', Е: 'E', З: 'Z', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X', Ә: 'Ə',
  Һ: 'H', І: 'I', Ј: 'J', Ү: 'Ü', Ө: 'Ö', Ғ: 'Ğ',
};
const azLower = (c: string) => (c === 'I' ? 'ı' : c === 'İ' ? 'i' : c.toLowerCase());
/** Letters that are words on their own in Azerbaijani ("O", the interjection "A", "Ə") */
const AZ_ONE_LETTER = 'OAƏEİIU';

/**
 * Azerbaijani OCR slips: Cyrillic look-alikes ("каш" → "kaş"), capitals inside a lowercase word
 * ("sÜKunət" → "sükunət", "edərəK" → "edərək"), and a capital split off its word ("Y aranmış")
 */
export function azOcr(text: string): string {
  return text
    .replace(/[Ѐ-ӿ]/g, (c) => AZ_CYRILLIC[c] ?? c)
    .replace(new RegExp(`(^|[^\\p{L}])([A-ZÇƏĞÖŞÜ]) (?=[a-zçəğıöşü]{2,})`, 'gu'), (m, pre, cap) =>
      AZ_ONE_LETTER.includes(cap) ? m : pre + cap,
    )
    .replace(/\p{L}+/gu, (word) =>
      /\p{Ll}/u.test(word) ? word[0] + [...word.slice(1)].map((c) => (/\p{Lu}/u.test(c) ? azLower(c) : c)).join('') : word,
    );
}

/** Where an editor's prose summary stood between verse passages */
const GAP = '[…]';

export interface SplitTranslation {
  workSlug: string;
  couplets: number;
  opening: string;
  body: string;
  warnings: string[];
}

export function loadSplitConfig(id: string): SplitConfig {
  return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, `${id}.json`), 'utf-8'));
}

/** Lines of a plain OCR text, on the page whose number closes them (a page number is its own line) */
function plainLines(text: string): Line[] {
  const raw = text.split('\n');
  const out: Line[] = [];
  let page = 0;
  // A line belongs to the page whose number comes next
  const numbers = raw.map((l) => (/^\s*\d{1,3}\s*$/.test(l) ? Number(l) : null));
  let next = numbers.length;
  const pageOf: number[] = [];
  for (let i = raw.length - 1; i >= 0; i--) {
    if (numbers[i] !== null) next = numbers[i]!;
    pageOf[i] = next;
  }
  raw.forEach((t, i) => {
    page = pageOf[i];
    out.push({ text: t, page, x: 0, right: 0, height: 0 } as Line);
  });
  return out;
}

/** The poem's verse lines in order, footnotes and page furniture gone, wrapped lines rejoined */
export async function poemLines(cfg: SplitConfig, opts: { sections?: boolean } = {}): Promise<string[]> {
  return (await poemPageLines(cfg, opts)).map((l) => l.text);
}

/** The poem's lines with the scan page each comes from (0-based), for proofreading */
export async function poemPageLines(cfg: SplitConfig, opts: { sections?: boolean } = {}): Promise<{ page: number; text: string }[]> {
  const meta = await cachedGetJson<{ result: { name: string }[] }>(`https://archive.org/metadata/${cfg.archiveId}/files`);
  const file = (suffix: string) => {
    const name = meta.result.find((f) => f.name.endsWith(suffix))?.name;
    if (!name) throw new Error(`No ${suffix} in ${cfg.archiveId}`);
    return cachedGet(`https://archive.org/download/${cfg.archiveId}/${encodeURIComponent(name)}`);
  };
  const lines: Line[] = cfg.plainText ? plainLines(await file('_djvu.txt')) : bookLines(await file('_djvu.xml'));

  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const start = lines.findIndex((l) => norm(l.text).startsWith(cfg.first));
  const end = lines.findIndex((l, i) => i > start && norm(l.text).startsWith(cfg.last));
  if (start < 0 || end < 0) throw new Error(`First or last line not found: "${start < 0 ? cfg.first : cfg.last}"`);

  const heads = new RegExp(cfg.runningHeads);
  // Each page's verse margin: the left edge most of its lines start at
  const margins = new Map<number, number>();
  const byPage = new Map<number, Line[]>();
  for (const l of lines.slice(start, end + 1)) byPage.set(l.page, [...(byPage.get(l.page) ?? []), l]);
  for (const [page, ls] of byPage) {
    const xs = ls.filter((l) => l.height >= cfg.noteHeight).map((l) => l.x).sort((a, b) => a - b);
    margins.set(page, xs[Math.floor(xs.length / 2)] ?? 0);
  }

  const out: { page: number; text: string }[] = [];
  let afterBreak = true; // a heading or prose was the last thing read
  for (const l of lines.slice(start, end + 1)) {
    const text = norm(l.text);
    // Running heads, and the rows of asterisks between scenes
    if (!text || heads.test(text) || /^[*•■\s]+$/.test(text)) continue;
    if (cfg.dropCaps && /\p{Lu}{3}/u.test(text) && !/\p{Ll}{2}/u.test(text)) {
      afterBreak = true;
      continue;
    }
    if (cfg.prose && (l.x < cfg.prose.left || (afterBreak && l.right >= cfg.prose.right))) {
      if (out.length && out[out.length - 1].text !== GAP) out.push({ page: l.page, text: GAP });
      afterBreak = true;
      continue;
    }
    // Page numbers, signature letters, section numerals (kept as "§ IV" for aligning by hand)
    if (/^([\divxlcIVXLC.\s]{1,7}|[A-Z])$/.test(text)) {
      if (opts.sections && /^[ivxlcIVXLC]+\.?$/.test(text) && l.height === 0 && l.x > (margins.get(l.page) ?? 0) + 150) out.push({ page: l.page, text: `§ ${text}` });
      continue;
    }
    if (l.height > 0 && l.height < cfg.noteHeight) continue;
    // A word or two in lowercase: set right of the margin, the end of the verse line above;
    // left of it, the last words of a footnote
    const margin = margins.get(l.page) ?? l.x;
    if (!cfg.plainText && /^[a-zа-яё]/.test(text) && text.split(' ').length <= 3) {
      if (out.length && l.x > margin + 60) out[out.length - 1].text += ` ${text}`;
      continue;
    }
    out.push({ page: l.page, text });
    afterBreak = false;
  }
  // Superscript footnote markers read as digits or stray letters after a word: "Saki,1", "veil l o'er"
  return out.map((l) => {
    let text = l.text.replace(/([A-Za-z,;:.!?'’])\d\b/g, '$1');
    // Endnote numbers set loose in the line ("qıfıla sarı 151 ,"): verse has no numerals in figures
    if (cfg.plainText) text = text.replace(/(\p{L}[,.;:!?»"”]?)\s*\d{1,3}(?=\s|[,.;:!?»"”]|$)/gu, '$1');
    text = text.replace(/\s+([,;:.!?])/g, '$1').trim();
    return { page: l.page, text: cfg.ocr === 'az' ? azOcr(text) : text };
  });
}

export async function planSplit(cfg: SplitConfig): Promise<{ translations: SplitTranslation[]; unusedCorrections: string[] }> {
  const used = new Set<number>();
  const usedTriplets = new Set<string>();
  let text = (await poemLines(cfg)).join('\n');
  (cfg.corrections ?? []).forEach((c, i) => {
    const next = 'from' in c ? text.split(c.from).join(c.to) : text.replace(new RegExp(c.pattern, c.flags ?? 'g'), c.to);
    if (next !== text) used.add(i);
    text = next;
  });
  const lines = text.split('\n').filter((l) => l.trim());

  const starts = Object.entries(cfg.starts)
    .map(([n, opening]) => {
      const at = lines.findIndex((l) => l.startsWith(opening));
      if (at < 0) throw new Error(`Work ${n}: no line starting "${opening}"`);
      return { n: Number(n), at };
    })
    .sort((a, b) => a.at - b.at);

  const translations = starts.map(({ n, at }, i) => {
    const chunk = lines.slice(at, starts[i + 1]?.at ?? lines.length);
    while (chunk[chunk.length - 1] === GAP) chunk.pop();
    const warnings: string[] = [];
    const couplets: string[] = [];
    // Paired like the original's couplets, afresh after each gap, bar the triplets the config
    // names; rhymes are too irregular in spelling to check
    let run: string[] = [];
    const flush = () => {
      for (let k = 0; k < run.length; ) {
        const triplet = cfg.triplets?.find((t) => run[k].startsWith(t));
        if (triplet) usedTriplets.add(triplet);
        const size = triplet ? 3 : 2;
        if (k + size > run.length) warnings.push(`${run.length} lines from "${run[0].slice(0, 30)}", one left over`);
        couplets.push(run.slice(k, k + size).join('\n'));
        k += size;
      }
      run = [];
    };
    for (const line of chunk) {
      if (line === GAP) {
        flush();
        couplets.push(GAP);
      } else run.push(line);
    }
    flush();
    return {
      workSlug: `${cfg.workSlugBase}-${n}`,
      couplets: couplets.filter((c) => c !== GAP).length,
      opening: chunk.slice(0, 2).join(' / '),
      body: couplets.join('\n\n'),
      warnings,
    };
  });
  const unusedCorrections = (cfg.corrections ?? [])
    .filter((_, i) => !used.has(i))
    .map((c) => ('from' in c ? c.from : `/${c.pattern}/`))
    .concat((cfg.triplets ?? []).filter((t) => !usedTriplets.has(t)).map((t) => `triplet: ${t}`));
  return { translations, unusedCorrections };
}
