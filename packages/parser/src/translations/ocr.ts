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

// Irregular forms the system word list (base forms only) leaves out
const IRREGULAR = `became began has hath doth does hast art wast wert women men children feet teeth was were did done
gone went saw seen took taken gave given came ran sang sung rose risen fell fallen flew flown drew drawn grew grown knew
known threw thrown wrote written spoke spoken spake broke broken chose chosen stole stolen wore worn tore torn bore borne
swore sworn slew slain smote smitten strove striven drove driven rode ridden hid hidden bit bitten ate eaten lay lain led
fled fed sped bled met sat shot lit sought bought brought caught taught thought fought wrought held beheld told sold stood
understood overthrew overcame sprang sprung swam drank drunk sank sunk rang wept slept kept swept crept dealt felt knelt
meant leapt spent sent bent lent built girt burnt spilt thee thou thy thine ye whosoever whatsoever wherefore`.split(/\s+/);

let dictionary: Set<string> | null = null;
function dict(): Set<string> {
  if (!dictionary) {
    dictionary = fs.existsSync(DICT_PATH)
      ? new Set(fs.readFileSync(DICT_PATH, 'utf-8').split('\n').map((w) => w.trim().toLowerCase()))
      : new Set();
    for (const w of IRREGULAR) dictionary.add(w);
  }
  return dictionary;
}

/**
 * Victorian British spellings the (American) system word list lacks:
 * "colour" → color, "centre" → center, "travelling" → traveling, "skilful" → skillful
 */
function britishToAmerican(w: string): string[] {
  const out: string[] = [];
  if (/our/.test(w)) out.push(w.replace(/our(?=s?$|ed|ing|ful|less|able|er|ite)/, 'or'));
  if (/re(s|d)?$/.test(w)) out.push(w.replace(/re(s|d)?$/, 'er$1'));
  if (/ll(ed|ing|er|ers)$/.test(w)) out.push(w.replace(/ll(ed|ing|er|ers)$/, 'l$1'));
  if (/lful/.test(w)) out.push(w.replace(/lful/, 'llful'));
  if (/is(e|ed|es|ing|ation)$/.test(w)) out.push(w.replace(/is(e|ed|es|ing|ation)$/, 'iz$1'));
  if (/ise$|ising$|ised$/.test(w)) out.push(w.replace(/is(e|ing|ed)$/, 'ic$1'));
  if (/ewell/.test(w)) out.push(w.replace(/ewell/, 'ewel'));
  if (/^despatch/.test(w)) out.push(w.replace(/^despatch/, 'dispatch'));
  return out;
}

export class Vocabulary {
  private trusted: Set<string>;

  /**
   * Capitalised words that recur in the book (names, Persian terms) count as known.
   * Lowercase ones don't: recurring OCR damage ("tbe", "aU") would be trusted too.
   */
  private counts = new Map<string, number>();

  /** extra: the book's own lowercase terms ("huri", "vazir"), known like dictionary words */
  constructor(text: string, minCount = 4, private extra = new Set<string>()) {
    for (const w of text.toLowerCase().match(/[a-z]+/g) ?? []) this.counts.set(w, (this.counts.get(w) ?? 0) + 1);
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

  /**
   * Leaves a word alone: the word list, its inflections, Victorian forms ("becamest",
   * "fulness") and British spellings. Loose on purpose — it only decides what not to touch.
   */
  inDictionary(word: string): boolean {
    const w = word.toLowerCase();
    if (this.isWord(w) || britishToAmerican(w).some((v) => this.isWord(v))) return true;
    if (/(\w)\1(ed|ing)$/.test(w) && dict().has(w.replace(/(\w)\1(ed|ing)$/, '$1'))) return true; // "occurred"
    // Not "-ful" or "-ness": "bandful" would pass as "band" + "-ful"
    for (const suffix of ['edst']) {
      if (w.endsWith(suffix) && w.length - suffix.length >= 3 && this.isWord(w.slice(0, -suffix.length))) return true;
    }
    return false;
  }

  /**
   * A real word, strictly: what a correction must turn into. The loose rules above would let
   * "handful" become "bandful" ("band" + "-ful").
   */
  isWord(word: string): boolean {
    const w = word.toLowerCase();
    if (dict().has(w) || this.extra.has(w) || (/s$/.test(w) && this.extra.has(w.slice(0, -1)))) return true;
    if (/ie[sd]$/.test(w) && dict().has(w.slice(0, -3) + 'y')) return true; // "armies", "replied"
    for (const suffix of ['s', 'es', 'ed', 'd', 'ing', 'ly', 'est', 'er', 'eth', 'st']) {
      if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
        const stem = w.slice(0, -suffix.length);
        if (dict().has(stem) || dict().has(stem + 'e')) return true;
      }
    }
    return false;
  }

  /** How often a word occurs in the book, any case */
  count(word: string): number {
    return this.counts.get(word.toLowerCase()) ?? 0;
  }
}

/** Common misreadings in early 20th-century scans: [seen, meant] */
const CONFUSIONS: [string, string][] = [
  ['fi', 'ff'], ['fl', 'ff'], ['lU', 'Ill'], ['U', 'll'], ['rn', 'm'], ['m', 'rn'],
  ['ii', 'h'], ['li', 'h'], ['b', 'h'], ['h', 'b'], ['k', 'h'], ['vd', 'wi'], ['tl', 'th'],
  ['e', 'c'], ['c', 'e'], ['e', 'r'], ['c', 'r'], ['t', 'h'], ['n', 'u'], ['u', 'n'], ['i', 'l'], ['l', 'i'],
  ['1', 'l'], ['0', 'o'],
  // Wilson's Haft Paikar (an Indian Digital Library scan) has its own: "tMs" (this), "stiH" (still),
  // "Kke" (like), "seK" (self), "foimd"/"roxmd" (found, round), "WTien"/"WHien" (When), "hiTn"
  // (him), "kmg" (king), "IVe" (We), "aSairs" (affairs), "witi" (with); E, B or P for F/R
  ['M', 'hi'], ['M', 'ki'], ['M', 'h'], ['M', 'lf'], ['H', 'll'], ['H', 'li'], ['H', 'il'], ['H', 'hi'], ['H', 'lf'],
  ['K', 'li'], ['K', 'lf'], ['h', 'lf'],
  ['im', 'un'], ['xm', 'un'], ['im', 'nn'], ['Ti', 'h'], ['Hi', 'h'], ['Ti', 'n'], ['Tn', 'm'], ['TY', 'm'],
  ['m', 'in'], ['IV', 'W'], ['S', 'ff'], ['S', 'fl'], ['E', 'ff'], ['i', 'h'],
  ['E', 'F'], ['E', 'R'], ['E', 'K'], ['B', 'F'], ['P', 'F'],
];

/** Two-letter misreadings, too short for the confusion search: "aU" (all), "Ms" (his) */
const SHORT: Record<string, string> = { aU: 'all', iU: 'ill', Ms: 'his', bj: 'by', mj: 'my' };

function candidates(word: string): string[] {
  const out: string[] = [];
  for (const [seen, meant] of CONFUSIONS) {
    for (let i = word.indexOf(seen); i >= 0; i = word.indexOf(seen, i + 1)) {
      out.push(word.slice(0, i) + meant + word.slice(i + seen.length));
    }
    // The same misreading twice in one word: "wbicb" → "which"
    if (word.split(seen).length > 2) out.push(word.split(seen).join(meant));
  }
  return out;
}

/**
 * Misreadings typical of names in transliteration-heavy books: the accented "ú" read as "ii"
 * ("Riim" for Rúm), "í" as "f" ("Firdausf"), a capital G as "Gr" ("Grod"), V as Y, N as X …
 * A name has no dictionary to check, so the book itself decides: see fixName.
 */
const NAME_CONFUSIONS: [RegExp, string][] = [
  [/ii/g, 'u'], [/f(?=[a-z]*$)/g, 'i'], [/^Gr/, 'G'], [/^Y(?=e|i)/, 'V'], [/^X(?=[aeiou])/, 'N'],
  [/^Av/, 'W'], [/^AV/, 'W'], [/^Pr(?=om)/, 'Fr'], [/rn/g, 'm'], [/in(?=[aeiou])/g, 'm'], [/cl/g, 'd'],
  [/aa/g, 'an'], [/^Kk/, 'Kh'], [/cb/g, 'ch'], [/iu/g, 'in'], [/^Mz/, 'Niz'], [/^(JST|IST|TsT)/, 'N'],
  [/^Rt/, 'Ru'], [/d(?=n$)/, 'u'], [/^Oh/, 'Ch'], [/^Oa/, 'Ca'], [/^Bx/, 'Ex'], [/^Bn/, 'En'],
  [/^Fh/, 'Fir'], [/^Fm/, 'Fir'],
];

function nameCandidates(word: string): string[] {
  const once = NAME_CONFUSIONS.map(([re, to]) => word.replace(re, to)).filter((c) => c !== word);
  // Two misreadings in one name: "TsTiishaba" → Nushaba
  const twice = once.flatMap((c) => NAME_CONFUSIONS.map(([re, to]) => c.replace(re, to)));
  return [...new Set([...once, ...twice])].filter((c) => c !== word);
}

/**
 * A name the book spells another way more often: "Niishaba" (17×) is Nushaba (30×). The form
 * found must occur at least as often as the misreading, or be an English word ("Grod" → God).
 */
function fixName(word: string, vocab: Vocabulary): string | null {
  if (!/^[A-Z]/.test(word)) return null;
  const seen = vocab.count(word);
  let best: string | null = null;
  for (const c of nameCandidates(word)) {
    const n = vocab.count(c);
    if (vocab.isWord(c) || (n >= 2 && n >= seen)) {
      if (!best || vocab.count(c) > vocab.count(best)) best = c;
    }
  }
  return best;
}

export interface OcrStats {
  fixed: number;
  unknown: number;
  words: number;
}

/**
 * Fix one word if a single confusion makes it known. Of several fixes, the one the book uses
 * most: "Mssed" is kissed, not hissed. A capital the confusion put in for a small letter
 * ("Hke" for like, "Ms" for his) is kept only at a sentence start
 */
function fixWord(word: string, vocab: Vocabulary, stats: OcrStats, sentenceStart: boolean): string {
  stats.words++;
  const recase = (c: string) => {
    if (!/^[A-Z]/.test(word)) return c;
    const sameLetter = c[0].toLowerCase() === word[0].toLowerCase();
    return sameLetter || sentenceStart || /^[A-Z]/.test(c) ? c[0].toUpperCase() + c.slice(1) : c;
  };
  if (word === 'AU') return 'All'; // "AU beings" — U for ll, capitalised
  if (SHORT[word]) {
    stats.fixed++;
    return recase(SHORT[word]);
  }
  // Acronyms and roman numerals are not OCR damage
  if (word.length < 3 || (word === word.toUpperCase() && /[A-Z]/.test(word)) || vocab.inDictionary(word)) return word;
  // A dictionary fix beats a recurring word: "Tbe" recurs at sentence starts but is "The".
  // But a recurring name ("Greece") is only "fixed" into a word the book uses more often
  const trusted = vocab.isTrusted(word);
  let best: string | null = null;
  for (const c of candidates(word)) {
    if (/[A-Z]/.test(c.slice(1)) && c !== c.toUpperCase()) continue;
    if (trusted && vocab.count(c) <= vocab.count(word)) continue;
    if (vocab.isWord(c) && (!best || vocab.count(c) > vocab.count(best))) best = c;
  }
  if (best) {
    stats.fixed++;
    return recase(best);
  }
  const name = fixName(word, vocab);
  if (name) {
    stats.fixed++;
    return name;
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
    // Margin couplet numbers and marks the layout left at a line start: "9° Not that …", "?.5 …"
    .replace(/^(?:\d{1,3}[°o]?|[?¿]\.?\d{1,3}|\d{1,2}[a-z])\s+(?=["“'‘(A-Z])/, '')
    .replace(/^1\s+(?=[a-z])/, 'I ') // "1 prepared many old treasures" — a capital I read as 1
    // Stray scanner marks: "joyful, with these words: — ■", "speech within speech; <", "as regards #> this"
    .replace(/\s*[■□▪•<>#~^|]+\s*$/, '')
    .replace(/\s+[#<>■|]+>?\s+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return t.replace(/[A-Za-z][A-Za-z01]*/g, (w, at: number) =>
    // A sentence starts after its closing mark, or a bracket at a sentence start: "(Then) to her sire"
    fixWord(w, vocab, stats, at === 0 || /(^|[.!?:;—"“‘'])\s*\(?\s*$/.test(t.slice(Math.max(0, at - 4), at))),
  );
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
