import { api } from '@/lib/api';
import { localized } from '@/lib/locale';
import Link from 'next/link';
import type { PaginatedResponse, AuthorSummary } from '@irs-az/shared';
import { AuthorFilters } from '@/components/authors/AuthorFilters';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const AZ_ALPHABET = 'ABCÇDEƏFGĞHXIİJKQLMNOÖPRSŞTUÜVYZ';

export default async function AuthorsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;

  const query = new URLSearchParams();
  if (sp.type) query.set('type', sp.type);
  if (sp.period) query.set('period', sp.period);
  if (sp.century) query.set('century', sp.century);
  if (sp.letter) query.set('letter', sp.letter);
  if (sp.page) query.set('page', sp.page);

  const result = (await api.getAuthors(query)) as PaginatedResponse<AuthorSummary>;

  return (
    <div className="container page-content">
      <header className="page-header" style={{ textAlign: 'left', paddingTop: 0 }}>
        <p className="section-label">
          {locale === 'ru' ? 'Авторы' : locale === 'en' ? 'Authors' : 'Müəlliflər'}
        </p>
        <h1>
          {locale === 'ru' ? 'Авторы' : locale === 'en' ? 'Authors' : 'Müəlliflər'}
        </h1>
      </header>

      <AuthorFilters locale={locale} current={sp} />

      <hr className="rule" style={{ margin: '1rem 0' }} />

      {/* Alphabet strip */}
      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {AZ_ALPHABET.split('').map((letter) => (
          <Link
            key={letter}
            href={`/${locale}/authors?letter=${letter}`}
            className={`pill ${sp.letter === letter ? 'active' : ''}`}
            style={{ minWidth: '1.75rem', textAlign: 'center', padding: '0.2rem 0.3rem' }}
          >
            {letter}
          </Link>
        ))}
        {sp.letter && (
          <Link
            href={`/${locale}/authors`}
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
                <span
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.6rem',
                    color: 'var(--pomeg)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    flexShrink: 0,
                    marginLeft: '0.5rem',
                  }}
                >
                  {author.type}
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
              href={`/${locale}/authors?page=${page}${sp.letter ? `&letter=${sp.letter}` : ''}${sp.type ? `&type=${sp.type}` : ''}`}
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
