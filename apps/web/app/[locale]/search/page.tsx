'use client';

import { Suspense, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { isArabicScript, langTag } from '@/lib/verse';

// useSearchParams needs a Suspense boundary for the page to prerender
export default function SearchPage() {
  return (
    <Suspense>
      <Search />
    </Suspense>
  );
}

function Search() {
  const t = useTranslations();
  const genres = useTranslations('contribute.options.genre');
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  // The query lives in the URL (?q=), so a search can be shared and survives reloads
  const q = useSearchParams().get('q')?.trim() ?? '';
  const [query, setQuery] = useState(q);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  // Results come 20 at a time; "show more" appends the next page
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setQuery(q);
    if (!q) {
      setResults(null);
      return;
    }
    let current = true;
    setLoading(true);
    setPage(1);
    api
      .search(new URLSearchParams({ q }))
      .then((data) => current && setResults(data))
      .catch(() => current && setResults(null))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [q]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data: any = await api.search(new URLSearchParams({ q, page: String(next) }));
      setResults((prev: any) => {
        const seen = new Set(prev.hits.map((h: any) => h.id));
        return { ...prev, hits: [...prev.hits, ...data.hits.filter((h: any) => !seen.has(h.id))] };
      });
      setPage(next);
    } catch {
      // Keep what is shown; the button stays so the reader can try again
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.replace(`/${locale}/search?${new URLSearchParams({ q: query.trim() })}`, { scroll: false });
  };

  return (
    <div className="container page-content">
      <header className="page-header" style={{ padding: '1.75rem 0 1rem' }}>
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
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          className="search-input"
        />
        <button type="submit" className="search-btn">
          {t('nav.search')}
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
                  {hit.genre && genres(hit.genre)}
                  {hit.year && ` · ${hit.year}`}
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
              {hit._formatted?.body && <Snippet html={hit._formatted.body} lang={hit.lang} />}
            </Link>
          ))}

          {results.hits?.length < results.estimatedTotalHits && (
            <div className="unfold">
              <button type="button" className="unfold-btn" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? '…' : t('search.more')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The passage that matched. It may come from the original or from any translation,
 * so its script decides the direction: Persian and Arabic-script Azerbaijani run
 * right to left in the Naskh face, never in a slanted Latin italic.
 */
function Snippet({ html, lang }: { html: string; lang?: string }) {
  const rtl = isArabicScript(html.replace(/<[^>]+>/g, ''));
  const tag = rtl ? (['FA', 'AR', 'AZ_ARABIC'].includes(lang ?? '') ? langTag[lang!] : 'fa') : undefined;
  return (
    <span
      className="search-snippet"
      lang={tag}
      dir={rtl ? 'rtl' : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
