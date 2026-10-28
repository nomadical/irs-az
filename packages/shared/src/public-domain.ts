/**
 * Who may be downloaded. Anyone may be read online, but a downloadable file (EPUB, TXT)
 * is offered only for authors in the public domain by life + 70: protection runs to the
 * end of the 70th year after death, so in 2026 an author who died in 1955 or earlier is free.
 *
 * Without a death year an author is public domain only when nobody could still be under
 * copyright: born at least MAX_LIFESPAN + 70 years before the current year, or, with no
 * birth year either, active (per the `period`, e.g. "XV-XVI əsr") in a century that ended
 * that long ago. In 2026 that means born ≤ 1845, or a latest century of XVIII or earlier.
 */

export const COPYRIGHT_TERM_YEARS = 70;
/** A deliberately generous human lifespan, so the undated cases err towards "protected" */
export const MAX_LIFESPAN_YEARS = 110;

export interface AuthorLifespan {
  bornYear?: number | null;
  diedYear?: number | null;
  /** Centuries in Roman numerals, e.g. "XIX əsr" or "XV-XVI əsr" */
  period?: string | null;
}

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };

function romanToInt(roman: string): number {
  let total = 0;
  for (let i = 0; i < roman.length; i++) {
    const value = ROMAN[roman[i]];
    const next = ROMAN[roman[i + 1]] ?? 0;
    total += value < next ? -value : value;
  }
  return total;
}

/** The latest century a period names ("XV-XVI əsr" → 16), or null */
export function latestCentury(period: string | null | undefined): number | null {
  const centuries = (period?.match(/\b[IVXLC]+\b/g) ?? []).map(romanToInt).filter((n) => n > 0);
  return centuries.length ? Math.max(...centuries) : null;
}

export function isPublicDomain(author: AuthorLifespan, year = new Date().getFullYear()): boolean {
  if (author.diedYear != null) return author.diedYear + COPYRIGHT_TERM_YEARS < year;
  const margin = MAX_LIFESPAN_YEARS + COPYRIGHT_TERM_YEARS;
  if (author.bornYear != null) return author.bornYear + margin < year;
  const century = latestCentury(author.period);
  return century != null && century * 100 + margin < year;
}

export type DownloadFormat = 'epub' | 'txt';
export const DOWNLOAD_FORMATS: DownloadFormat[] = ['epub', 'txt'];
