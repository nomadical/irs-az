import { api } from '@/lib/api';
import { localized } from '@/lib/locale';
import { plainLines, yearRange } from '@/lib/seo';
import { ogCard, ogContentType, ogSize } from '@/lib/og';

export const size = ogSize;
export const contentType = ogContentType;
export const alt = 'IRS.AZ';

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const author = (await api.getAuthor(slug)) as any;
  const firstSentence = plainLines(localized(author, 'bio', locale)).join(' ').split(/(?<=\.)\s/)[0];

  return ogCard({
    eyebrow: author.period ?? undefined,
    title: localized(author, 'name', locale) ?? author.nameAz,
    subtitle: yearRange(author.bornYear, author.diedYear),
    lines: firstSentence ? [firstSentence] : [],
  });
}
