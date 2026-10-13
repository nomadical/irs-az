import { MOOD_WORDS, THEME_WORDS, type Lexicon } from './lexicon';

/** Everything the rules look at for one work */
export interface WorkFacts {
  genre: string;
  form: string | null;
  year: number | null;
  authorSlug: string;
  collectionTitle: string | null;
  titleAz: string;
  /** Original and every translation, each with its Language enum */
  texts: { lang: string; body: string }[];
}

export interface TagResult {
  tags: string[];
  /** Words that matched, per theme and mood, for --explain */
  matched: Record<string, string[]>;
  /** Hits per 14 lines (a ghazal's length) for each theme and mood, for --dry-run reports */
  scores: Record<string, number>;
}

// Thresholds, in keyword hits per 14 lines of verse
const THEME_MIN = 1.5;
const MOOD_MIN = 2;
const MAX_THEMES = 3;
const MIN_HITS = 2;
const MIN_DISTINCT = 2;
const SHORT_LINES = 8; // ≤ 4 beyts
const LONG_LINES = 100;

const ARABIC_SCRIPT = /[؀-ۿ]/;
const FA_SUFFIXES = ['های', 'ها', 'هایی', 'مان', 'تان', 'شان', 'ست', 'یست', 'ام', 'ات', 'اش', 'ان', 'ی', 'ت', 'م', 'ش', 'ند', 'ید'];

/** One lexicon compiled for fast lookup */
interface Matcher {
  exact: Set<string>;
  prefixes: string[];
}

function compile(words: string[]): Matcher {
  const exact = new Set<string>();
  const prefixes: string[] = [];
  for (const w of words) {
    if (w.endsWith('*')) prefixes.push(w.slice(0, -1));
    else exact.add(w);
  }
  return { exact, prefixes };
}

type Script = 'az' | 'fa' | 'ru';
type Compiled = Record<string, Record<Script, Matcher>>;

function compileAll(lexicons: Record<string, Lexicon>): Compiled {
  return Object.fromEntries(
    Object.entries(lexicons).map(([slug, lex]) => [
      slug,
      { az: compile(lex.az), fa: compile(lex.fa), ru: compile(lex.ru) },
    ]),
  );
}

const THEMES = compileAll(THEME_WORDS);
const MOODS = compileAll(MOOD_WORDS);

function normalizeFa(text: string) {
  return text
    .replace(/[ً-ٰٟـ]/g, '') // harakat, superscript alef, tatweel
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإ]/g, 'ا')
    .replace(/‌/g, ''); // ZWNJ: the prefix it separates stays attached, so «می‌رود» is one token
}

function tokens(text: string, script: Script): string[] {
  const t = script === 'fa' ? normalizeFa(text) : text.toLocaleLowerCase(script === 'ru' ? 'ru' : 'az');
  return t.split(/[^\p{L}\p{M}]+/u).filter(Boolean);
}

function faMatches(token: string, m: Matcher) {
  if (m.exact.has(token)) return true;
  for (const suffix of FA_SUFFIXES) {
    if (token.length > suffix.length + 1 && token.endsWith(suffix) && m.exact.has(token.slice(0, -suffix.length))) {
      return true;
    }
  }
  return false;
}

function matches(token: string, m: Matcher, script: Script) {
  if (script === 'fa') return faMatches(token, m);
  if (m.exact.has(token)) return true;
  return m.prefixes.some((p) => token.startsWith(p));
}

/** Which lexicon a text is read with: by the script actually present, not the declared language */
function scriptOf(lang: string, body: string): Script | null {
  if (ARABIC_SCRIPT.test(body)) return 'fa';
  if (lang === 'RU') return 'ru';
  if (['AZ_LATIN', 'AZ_ARABIC', 'FA', 'AR', 'TR'].includes(lang)) return 'az'; // Latin transliterations included
  return null;
}

function verseLines(body: string) {
  return body
    .split('\n')
    .map((l) => l.replace(/^[#>*\s-]+/, '').trim())
    .filter(Boolean);
}

/**
 * Keyword density per category, pooled over the original and its translations.
 * A single hit never counts (one «شاه» in a rubai is a metaphor, not a panegyric),
 * nor does one word repeated (an oath of «tanrı» in a satire is not a hymn).
 */
function score(texts: WorkFacts['texts'], compiled: Compiled, matched: Record<string, string[]>) {
  const hits: Record<string, number> = Object.fromEntries(Object.keys(compiled).map((k) => [k, 0]));
  let lines = 0;
  for (const { lang, body } of texts) {
    const script = scriptOf(lang, body);
    if (!script) continue;
    lines += verseLines(body).length;
    for (const tok of tokens(body, script)) {
      for (const [slug, byScript] of Object.entries(compiled)) {
        if (matches(tok, byScript[script], script)) {
          hits[slug]++;
          (matched[slug] ??= []).push(tok);
        }
      }
    }
  }
  const per14 = 14 / Math.max(lines, SHORT_LINES);
  return Object.fromEntries(
    Object.entries(hits).map(([k, v]) => [
      k,
      v < MIN_HITS || new Set(matched[k]).size < MIN_DISTINCT ? 0 : Math.round(v * per14 * 100) / 100,
    ]),
  );
}

const ASHUG_FORMS = /qoşma|gəraylı|varsağı|bayatı|təcnis|deyişmə|divani|qıfılbənd|bağlama/i;
const SATIRE = /satir|dəyənək|felyeton/i;
const CHILDREN_TITLE = /(^|\s)(uşaq|bala|balalar|körpə|məktəb|şagird)/i;
const MODERN_AUTHORS = new Set(['sabir', 'vurgun', 'cavid', 'cabbarli', 'axundzade']);

/** Fallback when a work has no year: authors whose whole output sits in one era */
const AUTHOR_ERA: Record<string, string> = {
  xaqani: 'selcuq-dovru',
  nizami: 'selcuq-dovru',
  mahsati: 'selcuq-dovru',
  beylaqani: 'selcuq-dovru',
  falaki: 'selcuq-dovru',
  xetai: 'sefevi-dovru',
  fuzuli: 'sefevi-dovru',
  habibi: 'sefevi-dovru',
  saib: 'sefevi-dovru',
  qurbani: 'sefevi-dovru',
  qemkusar: 'maarifcilik',
  tufarqanli: 'sefevi-dovru',
  kocerli: 'maarifcilik',
  kemine: 'maarifcilik',
  nevvab: 'maarifcilik',
  axundzade: 'maarifcilik',
  sabir: 'maarifcilik',
  'seyid-ezim': 'maarifcilik',
  bakixanov: 'maarifcilik',
  elesger: 'asiq-poeziyasi',
  hadi: 'maarifcilik',
  sehhet: 'maarifcilik',
  musfiq: 'sovet-dovru',
  cavad: 'maarifcilik',
  memmedquluzade: 'maarifcilik',
  haqverdiyev: 'maarifcilik',
  vurgun: 'sovet-dovru',
};

function eraByYear(year: number) {
  if (year >= 1040 && year <= 1260) return 'selcuq-dovru';
  if (year >= 1501 && year <= 1736) return 'sefevi-dovru';
  if (year >= 1800 && year <= 1919) return 'maarifcilik';
  if (year >= 1920 && year <= 1991) return 'sovet-dovru';
  return null;
}

export function tagsFor(work: WorkFacts): TagResult {
  const tags = new Set<string>();
  const scores: Record<string, number> = {};
  const matched: Record<string, string[]> = {};
  const isPoem = work.genre === 'POEM';

  // Structural rules first: they are more reliable than any keyword
  if (work.collectionTitle && SATIRE.test(work.collectionTitle)) {
    tags.add('satira');
    tags.add('istehzali');
  }
  if (isPoem && work.collectionTitle && ASHUG_FORMS.test(work.collectionTitle)) tags.add('asiq-poeziyasi');
  if (MODERN_AUTHORS.has(work.authorSlug) && CHILDREN_TITLE.test(work.titleAz)) tags.add('usaqlar-ucun');
  if (/mərsiyə/i.test(work.titleAz)) tags.add('mersiye');

  const era = (work.year && eraByYear(work.year)) || AUTHOR_ERA[work.authorSlug];
  if (era) tags.add(era);

  if (isPoem) {
    const original = work.texts[0];
    const lines = original ? verseLines(original.body).length : 0;
    if (lines > 0 && lines <= SHORT_LINES) tags.add('qisa');
    if (lines >= LONG_LINES) tags.add('uzun');

    // Themes: the strongest few above the threshold. A qasida is a praise form by default.
    const themes = score(work.texts, THEMES, matched);
    if (work.form === 'QASIDA') themes.medh += 1;
    if (tags.has('satira')) themes['ilahi-eshq'] = 0;
    Object.assign(scores, themes);
    Object.entries(themes)
      .filter(([, v]) => v >= THEME_MIN)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_THEMES)
      .forEach(([slug]) => tags.add(slug));

    // Mood: at most one, and only when it clearly leads
    if (!tags.has('istehzali')) {
      const moods = score(work.texts, MOODS, matched);
      Object.assign(scores, moods);
      const [best, second] = Object.entries(moods).sort((a, b) => b[1] - a[1]);
      if (best && best[1] >= MOOD_MIN && best[1] >= (second?.[1] ?? 0) * 1.5) tags.add(best[0]);
    }
  }

  return { tags: [...tags], scores, matched };
}
