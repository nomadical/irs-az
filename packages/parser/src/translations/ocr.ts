/**
 * Cleanup for OCR text of scanned books (Internet Archive `_djvu.txt`).
 *
 * Fixes are conservative: a word is only changed when it is unknown and a single
 * known OCR confusion turns it into a known word. Unknown words with no such fix
 * (names, archaisms, real damage) are left alone and counted, so the report shows
 * how much proofreading a text still needs.
 */
import * as fs from 'fs';

const DICT_PATH = '/usr/share/dict/words';

let dictionary: Set<string> | null = null;
function dict(): Set<string> {
  if (!dictionary) {
    dictionary = fs.existsSync(DICT_PATH)
      ? new Set(fs.readFileSync(DICT_PATH, 'utf-8').split('\n').map((w) => w.trim().toLowerCase()))
      : new Set();
  }
  return dictionary;
}

export class Vocabulary {
  private trusted: Set<string>;

  /**
   * Capitalised words that recur in the book (names, Persian terms) count as known.
   * Lowercase ones don't: recurring OCR damage ("tbe", "aU") would be trusted too.
   */
  constructor(text: string, minCount = 4) {
    const counts = new Map<string, number>();
    for (const w of text.match(/\b[A-Z][a-z]+/g) ?? []) counts.set(w.toLowerCase(), (counts.get(w.toLowerCase()) ?? 0) + 1);
    this.trusted = new Set([...counts].filter(([, n]) => n >= minCount).map(([w]) => w));
  }

  knows(word: string): boolean {
    return this.isTrusted(word) || this.inDictionary(word);
  }

  isTrusted(word: string): boolean {
    return this.trusted.has(word.toLowerCase());
  }

  inDictionary(word: string): boolean {
    const w = word.toLowerCase();
    if (dict().has(w)) return true;
    // Inflections the word list leaves out
    for (const suffix of ['s', 'es', 'ed', 'd', 'ing', 'ly', 'est', 'er', 'eth', 'st']) {
      if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
        const stem = w.slice(0, -suffix.length);
        if (dict().has(stem) || dict().has(stem + 'e')) return true;
      }
    }
    return false;
  }
}

/** Common misreadings in early 20th-century scans: [seen, meant] */
const CONFUSIONS: [string, string][] = [
  ['fi', 'ff'], ['fl', 'ff'], ['lU', 'Ill'], ['U', 'll'], ['rn', 'm'], ['m', 'rn'],
  ['ii', 'h'], ['li', 'h'], ['b', 'h'], ['h', 'b'], ['k', 'h'], ['vd', 'wi'], ['tl', 'th'],
  ['e', 'c'], ['c', 'e'], ['e', 'r'], ['c', 'r'], ['t', 'h'], ['n', 'u'], ['u', 'n'], ['i', 'l'], ['l', 'i'],
  ['1', 'l'], ['0', 'o'],
];

function candidates(word: string): string[] {
  const out: string[] = [];
  for (const [seen, meant] of CONFUSIONS) {
    for (let i = word.indexOf(seen); i >= 0; i = word.indexOf(seen, i + 1)) {
      out.push(word.slice(0, i) + meant + word.slice(i + seen.length));
    }
  }
  return out;
}

export interface OcrStats {
  fixed: number;
  unknown: number;
  words: number;
}

/** Fix one word if a single confusion makes it known; keeps the original capitalisation */
function fixWord(word: string, vocab: Vocabulary, stats: OcrStats): string {
  stats.words++;
  if (word === 'AU') return 'All'; // "AU beings" — U for ll, capitalised
  // Acronyms and roman numerals are not OCR damage
  if (word.length < 3 || (word === word.toUpperCase() && /[A-Z]/.test(word)) || vocab.inDictionary(word)) return word;
  // A dictionary fix beats a recurring word: "Tbe" recurs at sentence starts but is "The"
  for (const c of candidates(word)) {
    if (/[A-Z]/.test(c.slice(1)) && c !== c.toUpperCase()) continue;
    if (vocab.inDictionary(c)) {
      stats.fixed++;
      return /^[A-Z]/.test(word) ? c[0].toUpperCase() + c.slice(1) : c;
    }
  }
  if (vocab.isTrusted(word)) return word; // a name or term the book uses throughout
  stats.unknown++;
  return word;
}

/** Clean one paragraph: joins wrapped lines, mends hyphenation, footnote marks, typography */
export function cleanParagraph(text: string, vocab: Vocabulary, stats: OcrStats): string {
  let t = text
    // "some-\ntimes" → "sometimes" when that is a word, otherwise keep the hyphen
    .replace(/(\w+)-\s*\n\s*(\w+)/g, (_, a: string, b: string) => (vocab.knows(a + b) ? a + b : `${a}-${b}`))
    .replace(/\s*\n\s*/g, ' ');

  t = t
    .replace(/\s*\(\s*[\dIl,.]*\d[\dIl,.]*\s*:?\s*\)/g, '') // footnote numbers: "(914)", "(1,029)", "(1.086)"
    .replace(/\^/g, '')
    .replace(/(^|[\s(—,"'‘“])0(?=\s+[A-Za-z])/g, '$1O') // "0 Thou" → "O Thou"
    .replace(/\s+[I1](?=\s*(?:[—–]|$))/g, ' !') // a lone I or 1 before a dash or at the end is "!"
    .replace(/\s+([!?;:,.])/g, '$1') // "thing !" → "thing!"
    .replace(/\s{2,}/g, ' ')
    .trim();

  return t.replace(/[A-Za-z][A-Za-z01]*/g, (w) => fixWord(w, vocab, stats));
}

/** Letters only, lowercase: for fuzzy heading comparison */
const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/** Dice coefficient on letter bigrams — tolerant of OCR slips inside headings */
export function similarity(a: string, b: string): number {
  const x = letters(a);
  const y = letters(b);
  if (x.length < 2 || y.length < 2) return x === y ? 1 : 0;
  const grams = new Map<string, number>();
  for (let i = 0; i < x.length - 1; i++) grams.set(x.slice(i, i + 2), (grams.get(x.slice(i, i + 2)) ?? 0) + 1);
  let shared = 0;
  for (let i = 0; i < y.length - 1; i++) {
    const g = y.slice(i, i + 2);
    const n = grams.get(g) ?? 0;
    if (n > 0) {
      shared++;
      grams.set(g, n - 1);
    }
  }
  return (2 * shared) / (x.length - 1 + y.length - 1);
}
