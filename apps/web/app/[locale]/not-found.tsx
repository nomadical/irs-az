import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NotFoundContent } from '@/components/layout/NotFoundContent';

/** The tab title in the reader's language; not-found pages are noindex either way */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('not_found');
  return { title: t('title') };
}

// Reached by notFound() inside a locale page (a missing work, author or tag)
export default function NotFound() {
  return <NotFoundContent />;
}
