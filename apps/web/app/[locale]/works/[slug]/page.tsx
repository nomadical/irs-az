import type { Metadata } from 'next';
import { api, getWorkOrRedirect } from '@/lib/api';
import { localized } from '@/lib/locale';
import { excerpt, pageMetadata, SITE_URL } from '@/lib/seo';
import Link from 'next/link';
import { ReadingView } from '@/components/reading/ReadingView';
import { JsonLd } from '@/components/seo/JsonLd';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const work = (await getWorkOrRedirect(slug, locale)) as any;
  const title = localized(work, 'title', locale) ?? work.titleAz;
  const authorName = localized(work.author, 'name', locale);

  return pageMetadata({
    locale,
    path: `/works/${slug}`,
    title: `${title} — ${authorName}`,
    description: excerpt(work.body, { poem: work.genre !== 'PROSE' }),
    type: 'article',
    images: false,
  });
}

export default async function WorkPage({ params }: Props) {
  const { locale, slug } = await params;

  const [work, nav] = await Promise.all([
    getWorkOrRedirect(slug, locale) as Promise<any>,
    // Old slugs redirect above, so nav only matters when the work exists
    api.getWorkNav(slug).catch(() => ({ prev: null, next: null })),
  ]);

  const t = await getTranslations({ locale, namespace: 'contribute' });
  const title = localized(work, 'title', locale);
  const authorName = localized(work.author, 'name', locale);
  const collectionTitle = work.collection
    ? localized(work.collection, 'title', locale)
    : null;

  return (
    <div className="container page-content">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: title,
          url: `${SITE_URL}/${locale}/works/${slug}`,
          genre: work.genre.toLowerCase(),
          ...(work.year && { dateCreated: String(work.year) }),
          author: {
            '@type': 'Person',
            name: authorName,
            url: `${SITE_URL}/${locale}/authors/${work.author.slug}`,
          },
          ...(collectionTitle && {
            isPartOf: {
              '@type': 'CreativeWork',
              name: collectionTitle,
              url: `${SITE_URL}/${locale}/collections/${work.collection.slug}`,
            },
          }),
        }}
      />

      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href={`/${locale}/authors/${work.author.slug}`}>{authorName}</Link>
        {collectionTitle && (
          <>
            <span className="breadcrumb-sep">›</span>
            <Link href={`/${locale}/collections/${work.collection.slug}`}>
              {collectionTitle}
            </Link>
          </>
        )}
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{title}</span>
      </div>

      {/* Title block — centered, editorial */}
      <header className="page-header" style={{ paddingTop: '0.5rem' }}>
        <h1 style={{ fontSize: '2.75rem' }}>{title}</h1>
        <div className="meta-strip" style={{ justifyContent: 'center', marginTop: '0.5rem' }}>
          <span>{work.genre.toLowerCase()}</span>
          {work.form && work.form !== 'OTHER' && (
            <>
              <span className="dot" />
              <span>{work.form.toLowerCase()}</span>
            </>
          )}
          {work.year && (
            <>
              <span className="dot" />
              <span>{work.yearApprox ? '~' : ''}{work.year}</span>
            </>
          )}
        </div>
      </header>

      <div className="ornament" />

      {/* Reading content */}
      <ReadingView
        body={work.bodyHtml || work.body}
        translations={work.translations}
        originalLang={work.originalLang}
        scriptDirection={work.scriptDirection}
        locale={locale}
        genre={work.genre}
      />

      {/* Source note */}
      {work.sourceNote && (
        <p
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.7rem',
            color: 'var(--muted)',
            textAlign: 'center',
            fontStyle: 'italic',
            marginBottom: '1rem',
          }}
        >
          {work.sourceNote}
        </p>
      )}

      <p className="work-suggest">
        <Link href={`/${locale}/contribute?type=translation&work=${encodeURIComponent(slug)}`}>
          + {t('suggest_translation')}
        </Link>
      </p>

      {/* Prev / Next navigation */}
      <div className="work-nav">
        {nav.prev ? (
          <Link href={`/${locale}/works/${nav.prev.slug}`} className="work-nav-btn">
            <span className="work-nav-dir">
              ← {locale === 'ru' ? 'Предыдущее' : locale === 'en' ? 'Previous' : 'Əvvəlki'}
            </span>
            <span className="work-nav-title">
              {localized(nav.prev, 'title', locale)}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {nav.next ? (
          <Link href={`/${locale}/works/${nav.next.slug}`} className="work-nav-btn work-nav-btn--next">
            <span className="work-nav-dir">
              {locale === 'ru' ? 'Следующее' : locale === 'en' ? 'Next' : 'Növbəti'} →
            </span>
            <span className="work-nav-title">
              {localized(nav.next, 'title', locale)}
            </span>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
