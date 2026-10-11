import type { Metadata } from 'next';
import { locales, defaultLocale } from './i18n';

export const SITE_NAME = 'IRS.AZ';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

const ogLocales: Record<string, string> = { az: 'az_AZ', ru: 'ru_RU', en: 'en_US' };

/** Canonical + hreflang links for a locale-less path such as `/works/foo`. */
export function alternates(locale: string, path = ''): Metadata['alternates'] {
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(locales.map((l) => [l, `/${l}${path}`])),
      'x-default': `/${defaultLocale}${path}`,
    },
  };
}

interface PageMeta {
  locale: string;
  path: string;
  title?: string;
  description?: string;
  type?: 'website' | 'article' | 'profile';
  /** Skip the "%s | IRS.AZ" template (home page). */
  absoluteTitle?: boolean;
  /**
   * Share images. Defaults to the locale's site card, because setting openGraph
   * here drops the parent's file-based image. Pass `false` for routes with their
   * own opengraph-image file, otherwise this would override it.
   */
  images?: string[] | false;
}

export function pageMetadata({
  locale, path, title, description, type = 'website', absoluteTitle, images,
}: PageMeta): Metadata {
  return {
    ...(title && { title: absoluteTitle ? { absolute: title } : title }),
    description,
    alternates: alternates(locale, path),
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: ogLocales[locale],
      alternateLocale: locales.filter((l) => l !== locale).map((l) => ogLocales[l]),
      url: `/${locale}${path}`,
      title,
      description,
      ...(images !== false && {
        images: images ?? [{ url: `/${locale}/opengraph-image`, width: 1200, height: 630, alt: SITE_NAME }],
      }),
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

/** Lines of plain text from markdown or HTML, with markup and blank lines dropped. */
export function plainLines(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .replace(/<\/(p|div|h\d|li)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => entities[e])
    .replace(/[#*_>`]/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Short description: poems keep their line breaks as " / ", prose is joined with spaces. */
export function excerpt(text: string | null | undefined, { poem = false, max = 160 } = {}): string | undefined {
  const joined = plainLines(text).join(poem ? ' / ' : ' ');
  if (!joined) return undefined;
  if (joined.length <= max) return joined;
  const cut = joined.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : max).replace(/[\s/,.;:]+$/, '')}…`;
}

export function yearRange(from?: number | null, to?: number | null): string | undefined {
  if (!from && !to) return undefined;
  return [from ?? '?', to ?? '?'].join('–');
}
