import type { Metadata } from 'next';
import { getTranslations as getMetaTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';
import { api } from '@/lib/api';
import { localized } from '@/lib/locale';
import Link from 'next/link';
import type { PaginatedResponse, AuthorSummary } from '@irs-az/shared';
import { AuthorFilters } from '@/components/authors/AuthorFilters';
import { notFound, permanentRedirect } from 'next/navigation';
import { CENTURIES } from '@irs-az/shared';
import { authorsPath, parseAuthorFacets } from '@/lib/facets';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const TYPE_NAV: Record<string, string> = {
  POET: 'poets',
  WRITER: 'writers',
  PHILOSOPHER: 'philosophers',
  PLAYWRIGHT: 'playwrights',
};

/** Filters from the readable path, and the heading they make: "Şairlər · XII əsr" */
async function resolveFilters(locale: string, sp: Record<string, string | string[] | undefined>) {
  const { filters, invalid, given } = parseAuthorFacets(sp.f);
  if (invalid) notFound();
  const t = await getMetaTranslations({ locale, namespace: 'nav' });
  const century = CENTURIES.find((c) => c.value === filters.century);
  const parts = [
    filters.type && t(TYPE_NAV[filters.type] as any),
    century && (locale === 'ru' ? century.labelRu : locale === 'en' ? century.labelEn : century.labelAz),
  ].filter(Boolean) as string[];
  return { filters, given, heading: parts.length ? parts.join(' · ') : t('authors') };
}

/** Author type in the reader's language; the database holds the enum (POET, WRITER…) */
const TYPE_LABELS: Record<string, Record<string, string>> = {
  POET:        { az: 'Şair', ru: 'Поэт', en: 'Poet' },
  WRITER:      { az: 'Yazıçı', ru: 'Писатель', en: 'Writer' },
  PLAYWRIGHT:  { az: 'Dramaturq', ru: 'Драматург', en: 'Playwright' },
  PHILOSOPHER: { az: 'Filosof', ru: 'Философ', en: 'Philosopher' },
  FOLK:        { az: 'Xalq ədəbiyyatı', ru: 'Народное творчество', en: 'Folk literature' },
};

const AZ_ALPHABET = 'ABCÇDEƏFGĞHXIİJKQLMNOÖPRSŞTUÜVYZ';

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getMetaTranslations({ locale });
  const { filters, heading } = await resolveFilters(locale, sp);

  return pageMetadata({
    locale,
    path: authorsPath(locale, filters, { letter: one(sp.letter), page: one(sp.page) }).slice(locale.length + 1),
    title: heading,
    description: t('site.description'),
  });
}

export default async function AuthorsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;

  const { filters, given, heading } = await resolveFilters(locale, sp);
  const letter = one(sp.letter);
  const canonical = authorsPath(locale, filters, { letter, page: one(sp.page) });
  const requested = authorsPath(locale, {}, { letter, page: one(sp.page) }).replace(
    `/${locale}/authors`,
    `/${locale}/authors${given.map((g) => `/${g}`).join('')}`,
  );
  if (canonical !== requested) permanentRedirect(canonical);

  const query = new URLSearchParams();
  if (filters.type) query.set('type', filters.type);
  if (one(sp.period)) query.set('period', one(sp.period)!);
  if (filters.century) query.set('century', String(filters.century));
  if (letter) query.set('letter', letter);
  if (one(sp.page)) query.set('page', one(sp.page)!);

  const result = (await api.getAuthors(query)) as PaginatedResponse<AuthorSummary>;

  return (
    <div className="container page-content">
      <header className="page-header page-header--start">
        <h1>{heading}</h1>
      </header>

      <AuthorFilters locale={locale} current={filters} />

      <hr className="rule" style={{ margin: '1rem 0' }} />

      {/* Alphabet strip */}
      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {AZ_ALPHABET.split('').map((letter) => (
          <Link
            key={letter}
            href={authorsPath(locale, filters, { letter: letter === sp.letter ? undefined : letter })}
            className={`pill ${sp.letter === letter ? 'active' : ''}`}
            style={{ minWidth: '1.75rem', textAlign: 'center', padding: '0.2rem 0.3rem' }}
          >
            {letter}
          </Link>
        ))}
        {sp.letter && (
          <Link
            href={authorsPath(locale, filters)}
            className="pill"
            style={{ padding: '0.2rem 0.6rem' }}
          >
            ✕
          </Link>
        )}
      </div>

      {/* Authors grid */}
      <div className="card-grid card-grid--3">
        {result.data.map((author) => {
          const name = localized(author, 'name', locale);
          return (
            <Link
              key={author.id}
              href={`/${locale}/authors/${author.slug}`}
              className="card-item"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', fontWeight: 600 }}>
                  {name}
                </span>
                <span className="author-type">
                  {TYPE_LABELS[author.type]?.[locale] ?? TYPE_LABELS[author.type]?.az ?? author.type}
                </span>
              </div>
              <div className="meta-strip" style={{ marginTop: '0.3rem' }}>
                <span>
                  {author.bornYearApprox && '~'}{author.bornYear}
                  {author.diedYear && ` — ${author.diedYearApprox ? '~' : ''}${author.diedYear}`}
                </span>
                {author.period && (
                  <>
                    <span className="dot" />
                    <span>{author.period}</span>
                  </>
                )}
                <span className="dot" />
                <span>
                  {author._count.works}{' '}
                  {locale === 'ru' ? 'произв.' : locale === 'en' ? 'works' : 'əsər'}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {result.data.length === 0 && (
        <p style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '2rem', fontStyle: 'italic' }}>
          {locale === 'ru' ? 'Ничего не найдено' : 'Heç nə tapılmadı'}
        </p>
      )}

      {/* Pagination */}
      {result.meta.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem', marginTop: '2rem' }}>
          {Array.from({ length: result.meta.totalPages }, (_, i) => i + 1).map((page) => (
            <Link
              key={page}
              href={authorsPath(locale, filters, { letter, page })}
              className={`pill ${page === result.meta.page ? 'active' : ''}`}
            >
              {page}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
