import { getTranslations } from 'next-intl/server';
import { ogCard, ogContentType, ogSize } from '@/lib/og';

export const size = ogSize;
export const contentType = ogContentType;
export const alt = 'IRS.AZ';

/** Default share card for every page without its own opengraph-image. */
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });

  return ogCard({
    title: t('description'),
    subtitle: t('tagline').replace(/◆/g, '').trim(),
  });
}
