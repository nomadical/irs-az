import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';

/** The not-found page's content, shared by the locale and root not-found pages */
export async function NotFoundContent() {
  const locale = await getLocale();
  const t = await getTranslations('not_found');
  const nav = await getTranslations('nav');
  const home = await getTranslations('home');

  return (
    <div className="container page-content not-found">
      <header className="page-header">
        <p className="not-found-code" aria-hidden="true">404</p>
        <h1>{t('title')}</h1>
        <p className="not-found-text">{t('text')}</p>
      </header>

      {/* A plain GET form: the search page reads ?q=, so this works without JavaScript */}
      <form action={`/${locale}/search`} method="get" className="not-found-search" role="search">
        <input
          type="search"
          name="q"
          enterKeyHint="search"
          placeholder={t('search_placeholder')}
          aria-label={nav('search')}
          className="search-input"
        />
        <button type="submit" className="search-btn">
          {nav('search')}
        </button>
      </form>

      <p className="not-found-links">
        <Link href={`/${locale}`} className="more">{nav('home')} →</Link>
        <Link href={`/${locale}/random`} prefetch={false} className="more">{home('random_poem')} →</Link>
      </p>
    </div>
  );
}
