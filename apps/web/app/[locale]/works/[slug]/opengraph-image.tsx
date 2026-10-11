import { api } from '@/lib/api';
import { localized } from '@/lib/locale';
import { plainLines } from '@/lib/seo';
import { ogCard, ogContentType, ogSize } from '@/lib/og';

export const size = ogSize;
export const contentType = ogContentType;
export const alt = 'IRS.AZ';

const LOCALE_LANGUAGE: Record<string, string> = { az: 'AZ_LATIN', ru: 'RU', en: 'EN' };

/**
 * Opening lines for the card. The card renderer can't shape Arabic script, so for
 * right-to-left originals use a translation into the page's language, if there is one.
 */
function previewLines(work: any, locale: string): string[] {
  if (work.scriptDirection !== 'RTL') return plainLines(work.body);
  const translation = work.translations?.find((t: any) => t.language === LOCALE_LANGUAGE[locale]);
  return translation ? plainLines(translation.body) : [];
}

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const work = (await api.getWork(slug)) as any;
  const collection = work.collection ? localized(work.collection, 'title', locale) : null;

  return ogCard({
    eyebrow: collection ?? work.genre.toLowerCase(),
    title: localized(work, 'title', locale) ?? work.titleAz,
    subtitle: [localized(work.author, 'name', locale), work.year].filter(Boolean).join(' · '),
    lines: work.genre === 'PROSE' ? [] : previewLines(work, locale),
  });
}
