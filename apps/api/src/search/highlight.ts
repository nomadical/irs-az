import { foldAz } from '../common/utils/slug';

/**
 * Search highlighting that ignores Azerbaijani letters, so "qezel" marks "Qəzəl".
 * Meilisearch can only highlight the field that matched, and plain-letter queries match
 * the *Plain copies, which are never shown. So matching is redone here on the original text.
 */

const WORD = /[\p{L}\p{N}]+/gu;
const SNIPPET_WORDS = 30;

const normalize = (text: string) => foldAz(text).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Terms {
  whole: string[];
  /** Like Meilisearch, only the last query word matches as a prefix (still being typed) */
  prefix: string | null;
}

/** Query words in comparable form. */
export function queryTerms(query: string): Terms {
  const list = normalize(query).match(WORD) ?? [];
  return { whole: list.slice(0, -1), prefix: list.at(-1) ?? null };
}

interface Word {
  start: number;
  end: number;
  match: boolean;
}

function words(text: string, terms: Terms): Word[] {
  return [...text.matchAll(WORD)].map((m) => {
    const word = normalize(m[0]);
    return {
      start: m.index!,
      end: m.index! + m[0].length,
      match: terms.whole.includes(word) || (terms.prefix !== null && word.startsWith(terms.prefix)),
    };
  });
}

/** HTML for text[from, to) with matched words wrapped in <mark>. */
function render(text: string, list: Word[], from: number, to: number): string {
  let html = '';
  let pos = from;
  for (const w of list) {
    if (w.start < from || w.end > to || !w.match) continue;
    html += `${escapeHtml(text.slice(pos, w.start))}<mark>${escapeHtml(text.slice(w.start, w.end))}</mark>`;
    pos = w.end;
  }
  return html + escapeHtml(text.slice(pos, to));
}

export function highlight(text: string, terms: Terms): string {
  return render(text, words(text, terms), 0, text.length);
}

const flatten = (text: string) => text.replace(/\s*\n\s*/g, ' / ').replace(/\s+/g, ' ').trim();

/**
 * A short excerpt around the first match, lines joined with " / ". Returns null when the
 * text has no match, so the caller can try another field.
 */
export function snippet(text: string, terms: Terms): string | null {
  const flat = flatten(text);
  const list = words(flat, terms);
  const first = list.findIndex((w) => w.match);
  if (first === -1) return null;

  const startIdx = Math.max(0, first - Math.floor(SNIPPET_WORDS / 3));
  const endIdx = Math.min(list.length, startIdx + SNIPPET_WORDS) - 1;
  const from = startIdx === 0 ? 0 : list[startIdx].start;
  const to = endIdx === list.length - 1 ? flat.length : list[endIdx].end;

  return `${from > 0 ? '…' : ''}${render(flat, list, from, to)}${to < flat.length ? '…' : ''}`;
}

/** The opening words, for hits that matched only on title or author. */
export function opening(text: string): string {
  const flat = flatten(text);
  const list = [...flat.matchAll(WORD)];
  if (list.length <= SNIPPET_WORDS) return escapeHtml(flat);
  const last = list[SNIPPET_WORDS - 1];
  return `${escapeHtml(flat.slice(0, last.index! + last[0].length))}…`;
}
