import { NextIntlClientProvider } from 'next-intl';
import type { Metadata } from 'next';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SkipLink } from '@/components/layout/SkipLink';
import { NotFoundContent } from '@/components/layout/NotFoundContent';

/** The tab title in the reader's language; not-found pages are noindex either way */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('not_found');
  return { title: t('title') };
}

/**
 * An address no route matches (/az/no-such-page). It renders outside the [locale] layout,
 * so it draws the site shell itself; being outside [locale]'s loading boundary, it also
 * keeps a real 404 status instead of the 200 a streamed page would send.
 */
export default async function RootNotFound() {
  const locale = await getLocale();
  const messages = await getMessages();
  const nav = await getTranslations('nav');

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <SkipLink label={nav('skip')} />
      <Header />
      <main id="main" tabIndex={-1}>
        <NotFoundContent />
      </main>
      <Footer />
    </NextIntlClientProvider>
  );
}
