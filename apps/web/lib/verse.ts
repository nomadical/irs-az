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

const PARA = /<p>([\s\S]*?)<\/p>/g;
const BR = /<br\s*\/?>/;

function beyt(a: string, b: string, maqtaLabel: string | null): string {
  const label = maqtaLabel ? `<span class="sr-only">${maqtaLabel}. </span>` : '';
  return `<p class="beyt${maqtaLabel ? ' beyt--maqta' : ''}">${label}<span class="misra">${a}</span><span class="misra">${b}</span></p>`;
}

/**
 * Lay verse out line by line so wrapped run-overs hang instead of reading as
 * new lines. Couplets (`<p>line<br>line</p>`) become beyts of two hemistichs
 * (misra); a masnavi stored as long stanzas is re-paired into beyts; anything
 * else keeps its stanzas with each line on its own. Non-paragraph HTML is
 * returned untouched.
 */
export function formatVerse(
  html: string,
  opts: { form?: string | null; maqtaLabel?: string } = {},
): { html: string; maqta: boolean } {
  const paras = [...html.matchAll(PARA)].map((m) => m[1].split(BR).map((l) => l.trim()).filter(Boolean));
  if (paras.length === 0 || html.replace(PARA, '').trim()) return { html, maqta: false };

  const isCouplets = paras.every((p) => p.length === 2);
  const lines = paras.flat();
  const isPairedMasnavi =
    !isCouplets && opts.form === 'MASNAVI' && paras.every((p) => p.length % 2 === 0);

  if (isCouplets || isPairedMasnavi) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < lines.length; i += 2) pairs.push([lines[i], lines[i + 1]]);
    // The maqta only exists in a complete ghazal, not a two-couplet excerpt
    const maqta = opts.form === 'GHAZAL' && pairs.length > 2;
    return {
      html: pairs
        .map(([a, b], i) => beyt(a, b, maqta && i === pairs.length - 1 ? opts.maqtaLabel ?? '' : null))
        .join(''),
      maqta,
    };
  }

  return {
    html: paras
      .map((p) => `<p class="stanza">${p.map((l) => `<span class="verse-line">${l}</span>`).join('')}</p>`)
      .join(''),
    maqta: false,
  };
}

/** The pieces of formatted verse, one per beyt or stanza, for line-up in parallel view */
export function verseBlocks(html: string): string[] | null {
  const blocks = html.match(/<p class="(?:beyt|stanza)[^"]*">[\s\S]*?<\/p>/g);
  return blocks && blocks.join('') === html ? blocks : null;
}

/**
 * Roughly how many lines a text takes to read: its verse lines (hemistichs and free lines),
 * or for prose, its length in ~80-character lines plus a break per paragraph.
 */
export function lineCount(html: string): number {
  const verse = (html.match(/class="(?:misra|verse-line)/g) ?? []).length;
  if (verse) return verse;
  const text = html.replace(/<[^>]+>/g, '');
  return Math.ceil(text.length / 80) + (html.match(/<\/p>/g) ?? []).length;
}

/** First hemistich of a poem, as plain text: the name a ghazal is known by */
export function incipit(html: string): string | null {
  const first = html.match(/<p[^>]*>([\s\S]*?)(?:<br\s*\/?>|<\/p>)/);
  if (!first) return null;
  const text = first[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return text || null;
}

/** Titles that are only a form and a number ("Qəzəl 7", "Газель № 7") */
export function isNumberedTitle(title: string | null): boolean {
  return !!title && /^[^\d]{1,24}?\s*(№|No\.)?\s*\d+$/u.test(title.trim());
}

// Ganjoor publishes no explicit licence; add it here once confirmed
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
    const label = host === 'ganjoor.net'
      ? 'Ganjoor'
      : host === 'archive.org'
        ? 'Internet Archive'
        : host.endsWith('wikisource.org')
        ? 'Wikisource'
        : host.endsWith('wikipedia.org')
          ? 'Wikipedia'
          : host;
    const license = Object.entries(LICENSES).find(([h]) => host.endsWith(h))?.[1] ?? null;
    return { href: url.toString(), label, license };
  } catch {
    return { href: null, label: trimmed, license: null };
  }
}
