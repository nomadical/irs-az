import { foldAz } from '../common/utils/slug';

/**
 * Search highlighting. Meilisearch only highlights the field that matched, and queries typed
 * without Azerbaijani letters match the hidden *Plain copies, so highlights are built here:
 * a word is marked when Meilisearch reported a match inside it (which covers typo matches),
 * or when it matches the query ignoring Azerbaijani letters.
 */

const WORD = /[\p{L}\p{N}]+/gu;
const SNIPPET_WORDS = 30;

const normalize = (text: string) => foldAz(text).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escaped text with line breaks shown as " / ", for one-line snippets. */
const flatHtml = (text: string) => escapeHtml(text.replace(/\s*\n\s*/g, ' / ').replace(/\s+/g, ' '));

export interface Terms {
  whole: string[];
  /** Like Meilisearch, only the last query word matches as a prefix (still being typed) */
  prefix: string | null;
}

/** Query words in comparable form. */
export function queryTerms(query: string): Terms {
  const list = normalize(query).match(WORD) ?? [];
  return { whole: list.slice(0, -1), prefix: list.at(-1) ?? null };
}

/**
 * Character offsets of Meilisearch's `_matchesPosition` entries in `text`. Meilisearch reports
 * `start` in UTF-8 bytes. For a *Plain field (`plain: true`) the bytes are counted in the folded
 * text; folding maps each character to one character, so the offset also fits the original.
 */
export function matchStarts(text: string, positions: { start: number }[] | undefined, plain = false): number[] {
  if (!positions?.length) return [];
  const bytes = Buffer.from(plain ? foldAz(text) : text, 'utf8');
  return positions.map((p) => bytes.subarray(0, p.start).toString('utf8').length);
}

interface Word {
  start: number;
  end: number;
  match: boolean;
}

function words(text: string, terms: Terms, starts: number[]): Word[] {
  return [...text.matchAll(WORD)].map((m) => {
    const start = m.index!;
    const end = start + m[0].length;
    const word = normalize(m[0]);
    return {
      start,
      end,
      match:
        starts.some((s) => s >= start && s < end) ||
        terms.whole.includes(word) ||
        (terms.prefix !== null && word.startsWith(terms.prefix)),
    };
  });
}

/** HTML for text[from, to) with matched words wrapped in <mark>. */
function render(text: string, list: Word[], from: number, to: number, toHtml: (s: string) => string) {
  let html = '';
  let pos = from;
  for (const w of list) {
    if (w.start < from || w.end > to || !w.match) continue;
    html += `${toHtml(text.slice(pos, w.start))}<mark>${escapeHtml(text.slice(w.start, w.end))}</mark>`;
    pos = w.end;
  }
  return html + toHtml(text.slice(pos, to));
}

export function highlight(text: string, terms: Terms, starts: number[] = []): string {
  return render(text, words(text, terms, starts), 0, text.length, escapeHtml);
}

/**
 * A short one-line excerpt around the first match. Returns null when the text has no match,
 * so the caller can try another field.
 */
export function snippet(text: string, terms: Terms, starts: number[] = []): string | null {
  const list = words(text, terms, starts);
  const first = list.findIndex((w) => w.match);
  if (first === -1) return null;

  const startIdx = Math.max(0, first - Math.floor(SNIPPET_WORDS / 3));
  const endIdx = Math.min(list.length, startIdx + SNIPPET_WORDS) - 1;
  const from = startIdx === 0 ? 0 : list[startIdx].start;
  const to = endIdx === list.length - 1 ? text.length : list[endIdx].end;

  const html = render(text, list, from, to, flatHtml).trim();
  return `${from > 0 ? '…' : ''}${html}${to < text.trimEnd().length ? '…' : ''}`;
}

/** The opening words, for hits that matched only on title or author. */
export function opening(text: string): string {
  const list = [...text.matchAll(WORD)];
  if (list.length <= SNIPPET_WORDS) return flatHtml(text.trim());
  const last = list[SNIPPET_WORDS - 1];
  return `${flatHtml(text.slice(0, last.index! + last[0].length).trim())}…`;
}
