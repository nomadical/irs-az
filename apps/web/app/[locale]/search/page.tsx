'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function SearchPage() {
  const t = useTranslations();
  const { locale } = useParams<{ locale: string }>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query });
      const data = await api.search(params);
      setResults(data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page-content">
      <header className="page-header" style={{ paddingBottom: '1rem' }}>
        <p className="section-label">{t('nav.search')}</p>
        <h1>{t('nav.search')}</h1>
      </header>

      <form
        onSubmit={handleSearch}
        style={{
          display: 'flex',
          gap: '0.5rem',
          maxWidth: '36rem',
          margin: '0 auto 2rem',
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          className="search-input"
        />
        <button type="submit" className="btn btn-primary">
          ◆ {t('nav.search').toUpperCase()}
        </button>
      </form>

      {loading && (
        <p style={{ color: 'var(--muted)', textAlign: 'center' }}>...</p>
      )}

      {results && (
        <div style={{ maxWidth: '36rem', margin: '0 auto' }}>
          <p className="meta-strip" style={{ marginBottom: '1.5rem', justifyContent: 'center' }}>
            <span>
              {results.estimatedTotalHits > 0
                ? t('search.results', { count: results.estimatedTotalHits })
                : t('search.no_results')}
            </span>
          </p>

          {results.hits?.map((hit: any) => (
            <Link
              key={hit.id}
              href={`/${locale}/works/${hit.slug}`}
              className="work-row"
              style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <strong
                  className="work-row-title"
                  dangerouslySetInnerHTML={{
                    __html: hit._formatted?.titleAz || hit.titleAz,
                  }}
                />
                <span className="work-row-meta">
                  {hit.genre?.toLowerCase()} {hit.year && `· ${hit.year}`}
                </span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.75rem',
                  color: 'var(--muted)',
                }}
                dangerouslySetInnerHTML={{
                  __html: hit._formatted?.authorNameAz || hit.authorNameAz,
                }}
              />
              {hit._formatted?.body && (
                <span
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--warm-brown)',
                    fontStyle: 'italic',
                    lineHeight: 1.6,
                  }}
                  dangerouslySetInnerHTML={{ __html: hit._formatted.body }}
                />
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
