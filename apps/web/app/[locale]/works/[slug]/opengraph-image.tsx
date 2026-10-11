import { api } from '@/lib/api';
import { localized } from '@/lib/locale';
import { plainLines } from '@/lib/seo';
import { ogCard, ogContentType, ogSize } from '@/lib/og';

export const size = ogSize;
export const contentType = ogContentType;
export const alt = 'IRS.AZ';

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const work = (await api.getWork(slug)) as any;
  const collection = work.collection ? localized(work.collection, 'title', locale) : null;

  return ogCard({
    eyebrow: collection ?? work.genre.toLowerCase(),
    title: localized(work, 'title', locale) ?? work.titleAz,
    subtitle: [localized(work.author, 'name', locale), work.year].filter(Boolean).join(' · '),
    lines: work.genre === 'PROSE' ? [] : plainLines(work.body),
  });
}
