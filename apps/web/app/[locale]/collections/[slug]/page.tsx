import type { Metadata } from 'next';
import { api, notFoundOn404 } from '@/lib/api';
import { localized } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const collection = (await api.getCollection(slug).catch(notFoundOn404)) as any;
  const title = localized(collection, 'title', locale) ?? collection.titleAz;
  const authorName = localized(collection.author, 'name', locale);
  const firstWorks = collection.works.slice(0, 5).map((w: any) => localized(w, 'title', locale)).join(', ');

  return pageMetadata({
    locale,
    path: `/collections/${slug}`,
    title: `${title} — ${authorName}`,
    description: `${authorName}, ${title}: ${firstWorks}${collection.works.length > 5 ? '…' : ''}`,
  });
}

export default async function CollectionPage({ params }: Props) {
  const { locale, slug } = await params;
  const collection = (await api.getCollection(slug).catch(notFoundOn404)) as any;

  const title = localized(collection, 'title', locale);
  const authorName = localized(collection.author, 'name', locale);

  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      {/* Breadcrumb */}
      <nav
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.8rem',
          color: 'var(--muted)',
          marginBottom: '0.5rem',
        }}
      >
        <Link
          href={`/${locale}/authors/${collection.author.slug}`}
          style={{ color: 'var(--muted)', textDecoration: 'none' }}
        >
          {authorName}
        </Link>
      </nav>

      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{title}</h1>
      <p
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.8rem',
          color: 'var(--muted)',
        }}
      >
        {collection.genre}
        {collection.year && ` · ${collection.yearApprox ? '~' : ''}${collection.year}`}
        {` · ${collection.works.length} `}
        {locale === 'ru' ? 'произв.' : locale === 'en' ? 'works' : 'əsər'}
      </p>

      <div className="ornament" />

      {/* Works list — table-of-contents style */}
      <div
        style={{
          maxWidth: '36rem',
          margin: '0 auto',
        }}
      >
        {collection.works.map((work: any, i: number) => (
          <Link
            key={work.id}
            href={`/${locale}/works/${work.slug}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '0.75rem 0',
              borderBottom: '1px solid var(--rule)',
              textDecoration: 'none',
              color: 'var(--ink)',
            }}
          >
            <span>
              <span
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.75rem',
                  color: 'var(--muted)',
                  marginRight: '0.75rem',
                  minWidth: '2rem',
                  display: 'inline-block',
                }}
              >
                {i + 1}.
              </span>
              <span style={{ fontFamily: 'var(--font-serif)' }}>
                {localized(work, 'title', locale)}
              </span>
            </span>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.7rem',
                color: 'var(--muted)',
                flexShrink: 0,
                marginLeft: '1rem',
              }}
            >
              {work.form && work.form !== 'OTHER' ? work.form.toLowerCase() : work.genre.toLowerCase()}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
