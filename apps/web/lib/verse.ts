/** BCP 47 tags for the Language enum, so screen readers and fonts pick the right script */
export const langTag: Record<string, string> = {
  AZ_LATIN: 'az-Latn',
  AZ_ARABIC: 'az-Arab',
  AZ_CYRILLIC: 'az-Cyrl',
  FA: 'fa',
  AR: 'ar',
  RU: 'ru',
  EN: 'en',
  TR: 'tr',
};

/** Translation language a reader of each UI locale should see first */
export const localeLang: Record<string, string> = {
  az: 'AZ_LATIN',
  ru: 'RU',
  en: 'EN',
};

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

export function isArabicScript(text: string | null | undefined): boolean {
  return !!text && ARABIC_SCRIPT.test(text);
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toLatinDigits(s: string): string {
  return s.replace(/[۰-۹٠-٩]/g, (d) => {
    const i = PERSIAN_DIGITS.indexOf(d);
    return String(i >= 0 ? i : ARABIC_DIGITS.indexOf(d));
  });
}

export interface DisplayTitle {
  /** Title in the reader's script */
  text: string;
  /** Original-script title shown beneath, when the main title had to be derived */
  original: string | null;
}

/**
 * Imported Ganjoor titles are Persian placeholders like "شمارهٔ ۷" (No. 7) or
 * "بخش ۴ - …" (Part 4). Readers of the AZ/RU/EN UI get "Qəzəl № 7" instead,
 * with the Persian title kept as a subtitle.
 */
export function displayTitle(
  title: string | null,
  opts: { formLabel: string | null; sectionLabel: string; numbered: (form: string, n: string) => string },
): DisplayTitle {
  if (!title) return { text: '', original: null };
  if (!isArabicScript(title)) return { text: title, original: null };

  const numbered = title.match(/^شماره[ٔه]?\s*([۰-۹٠-٩0-9]+)/);
  if (numbered && opts.formLabel) {
    return { text: opts.numbered(opts.formLabel, toLatinDigits(numbered[1])), original: title };
  }
  const section = title.match(/^بخش\s*([۰-۹٠-٩0-9]+)/);
  if (section) {
    return { text: opts.numbered(opts.sectionLabel, toLatinDigits(section[1])), original: title };
  }
  return { text: title, original: null };
}

/** Collections imported without a curated title carry their slug as title */
export function isPlaceholderTitle(title: string | null, slug: string): boolean {
  return !title || title === slug || /^[a-z0-9]+(-[a-z0-9]+)+$/.test(title);
}

/**
 * Turn `<p>line<br>line</p>` couplets into beyt markup so each hemistich
 * (misra) can be laid out on its own. Leaves anything else untouched.
 */
export function formatVerse(html: string, opts: { markLast?: boolean } = {}): string {
  const paras = html.match(/<p>[\s\S]*?<\/p>/g);
  if (!paras || paras.length === 0) return html;
  const leftover = html.replace(/<p>[\s\S]*?<\/p>/g, '').trim();
  if (leftover) return html;

  const couplets = paras.map((p) => p.slice(3, -4).split(/<br\s*\/?>/).map((l) => l.trim()));
  if (!couplets.every((c) => c.length === 2 && c[0] && c[1])) return html;

  return couplets
    .map((c, i) => {
      const last = opts.markLast && i === couplets.length - 1 && couplets.length > 2;
      return `<p class="beyt${last ? ' beyt--maqta' : ''}"><span class="misra">${c[0]}</span><span class="misra">${c[1]}</span></p>`;
    })
    .join('');
}

const LICENSES: Record<string, string> = {
  'wikisource.org': 'CC BY-SA 4.0',
  'wikipedia.org': 'CC BY-SA 4.0',
};

export interface SourceInfo {
  href: string | null;
  label: string;
  license: string | null;
}

/** Present a raw source note as a named, linked source */
export function sourceInfo(note: string | null | undefined): SourceInfo | null {
  if (!note) return null;
  const trimmed = note.trim();
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '');
    const label = host === 'ganjoor.net' ? 'Ganjoor' : host;
    const license = Object.entries(LICENSES).find(([h]) => host.endsWith(h))?.[1] ?? null;
    return { href: url.toString(), label, license };
  } catch {
    return { href: null, label: trimmed, license: null };
  }
}
