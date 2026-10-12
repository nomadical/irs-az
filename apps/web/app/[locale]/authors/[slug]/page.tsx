import type { Metadata } from 'next';
import { api, notFoundOn404 } from '@/lib/api';
import { localized } from '@/lib/locale';
import { excerpt, pageMetadata, SITE_URL } from '@/lib/seo';
import Link from 'next/link';
import { JsonLd } from '@/components/seo/JsonLd';
import { ArtworkGallery } from '@/components/artworks/ArtworkGallery';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

const langLabels: Record<string, Record<string, string>> = {
  AZ_LATIN:   { az: 'Azərbaycanca', ru: 'Азербайджанский', en: 'Azerbaijani' },
  AZ_ARABIC:  { az: 'Azərbaycanca (ərəb)', ru: 'Азерб. (араб.)', en: 'Azerbaijani (Arabic)' },
  FA:         { az: 'Farsca', ru: 'Персидский', en: 'Persian' },
  AR:         { az: 'Ərəbcə', ru: 'Арабский', en: 'Arabic' },
  RU:         { az: 'Rusca', ru: 'Русский', en: 'Russian' },
  TR:         { az: 'Türkcə', ru: 'Турецкий', en: 'Turkish' },
};

const typeLabels: Record<string, Record<string, string>> = {
  POET:        { az: 'Şair', ru: 'Поэт', en: 'Poet' },
  WRITER:      { az: 'Yazıçı', ru: 'Писатель', en: 'Writer' },
  PLAYWRIGHT:  { az: 'Dramaturq', ru: 'Драматург', en: 'Playwright' },
  PHILOSOPHER: { az: 'Filosof', ru: 'Философ', en: 'Philosopher' },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const author = (await api.getAuthor(slug).catch(notFoundOn404)) as any;

  return pageMetadata({
    locale,
    path: `/authors/${slug}`,
    title: localized(author, 'name', locale) ?? author.nameAz,
    description: excerpt(localized(author, 'bio', locale)),
    type: 'profile',
    images: false,
  });
}

export default async function AuthorPage({ params }: Props) {
  const { locale, slug } = await params;
  const author = (await api.getAuthor(slug).catch(notFoundOn404)) as any;

  const name = localized(author, 'name', locale) ?? '';
  const bio = localized(author, 'bio', locale);

  const years = [
    author.bornYear ? `${author.bornYearApprox ? '~' : ''}${author.bornYear}` : null,
    author.diedYear ? `${author.diedYearApprox ? '~' : ''}${author.diedYear}` : null,
  ].filter(Boolean).join(' — ');

  return (
    <div className="container page-content">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name,
          url: `${SITE_URL}/${locale}/authors/${slug}`,
          jobTitle: typeLabels[author.type]?.[locale],
          ...(author.bornYear && { birthDate: String(author.bornYear) }),
          ...(author.diedYear && { deathDate: String(author.diedYear) }),
          ...(author.portraitUrl && { image: author.portraitUrl }),
          description: excerpt(bio, { max: 300 }),
        }}
      />

      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href={`/${locale}/authors`}>
          ← {locale === 'ru' ? 'Авторы' : locale === 'en' ? 'Authors' : 'Müəlliflər'}
        </Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{name}</span>
      </div>

      {/* Author header — portrait + info grid */}
      <div className="author-header-grid">
        <div>
          <div className="portrait-placeholder">
            {author.portraitUrl ? (
              <img src={author.portraitUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <>
                <svg width="44" height="58" viewBox="0 0 44 58" fill="none">
                  <circle cx="22" cy="17" r="13" stroke="var(--rule)" strokeWidth="1"/>
                  <path d="M2 58 Q12 42 22 38 Q32 42 42 58" stroke="var(--rule)" strokeWidth="1" fill="none"/>
                </svg>
                <span className="portrait-placeholder-label">
                  {locale === 'ru' ? 'Нет портрета' : locale === 'en' ? 'No portrait' : 'Portret yoxdur'}
                </span>
              </>
            )}
          </div>
          {/* Credit the portrait: most are public domain, some CC BY-SA (artist, year, licence) */}
          {author.portraitUrl && author.portraitCredit && (
            <p
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.6rem',
                lineHeight: 1.3,
                color: 'var(--muted)',
                marginTop: '0.35rem',
                maxWidth: '130px',
                overflowWrap: 'anywhere',
              }}
            >
              {author.portraitSource ? (
                <a href={author.portraitSource} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                  {author.portraitCredit}
                </a>
              ) : (
                author.portraitCredit
              )}
            </p>
          )}
        </div>

        <div>
          <h1 className="author-name">{name}</h1>
          <div className="author-period">
            {years}
            {author.type && ` · ${typeLabels[author.type]?.[locale] ?? author.type}`}
            {author.period && ` · ${author.period}`}
          </div>

          {/* Language tags */}
          {author.writingLangs?.length > 0 && (
            <div className="author-tags">
              {author.writingLangs.map((l: string) => (
                <span key={l} className="author-tag">
                  {langLabels[l]?.[locale] ?? l}
                </span>
              ))}
            </div>
          )}

          {/* Bio excerpt */}
          {bio && (
            <div
              className="author-bio"
              dangerouslySetInnerHTML={{ __html: bio }}
            />
          )}
        </div>
      </div>

      <ArtworkGallery artworks={author.artworks ?? []} locale={locale} showCollection initial={6} />

      {/* Collections with works */}
      {author.collections?.map((collection: any, idx: number) => (
        <section key={collection.id} style={{ marginBottom: '1rem' }}>
          {idx > 0 && <hr className="rule" style={{ margin: '1rem 0' }} />}

          <div className="coll-header">
            <Link
              href={`/${locale}/collections/${collection.slug}`}
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              {localized(collection, 'title', locale)}
            </Link>
            {collection.year && (
              <span> · {collection.yearApprox && '~'}{collection.year}</span>
            )}
            {collection.works?.length > 0 && (
              <span> · {collection.works.length} {locale === 'ru' ? 'произв.' : locale === 'en' ? 'works' : 'əsər'}</span>
            )}
          </div>

          <ul className="work-list">
            {collection.works?.map((work: any) => (
              <li key={work.id} className="work-list-item">
                <Link href={`/${locale}/works/${work.slug}`} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span className="work-title">
                    {localized(work, 'title', locale)}
                  </span>
                  <span className="work-year">
                    {work.form && work.form !== 'OTHER' ? work.form.toLowerCase() : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Standalone works */}
      {author.works?.length > 0 && (
        <section style={{ marginTop: '1rem' }}>
          <hr className="rule" style={{ margin: '1rem 0' }} />
          <div className="coll-header">
            {locale === 'ru' ? 'Отдельные произведения' : locale === 'en' ? 'Standalone works' : 'Sərbəst əsərlər'}
          </div>
          <ul className="work-list">
            {author.works.map((work: any) => (
              <li key={work.id} className="work-list-item">
                <Link href={`/${locale}/works/${work.slug}`} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span className="work-title">
                    {localized(work, 'title', locale)}
                  </span>
                  <span className="work-year">
                    {work.genre.toLowerCase()}
                    {work.year && ` · ${work.year}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
