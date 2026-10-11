import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { api } from '../../lib/api';
import { localized } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const CENTURIES = [
  { label: 'XI', y: 11 }, { label: 'XII', y: 12 }, { label: 'XIII', y: 13 },
  { label: 'XVI', y: 16 }, { label: 'XVII', y: 17 }, { label: 'XIX', y: 19 },
  { label: 'XX', y: 20 },
];

const GENRES = [
  { key: 'GHAZAL',  az: 'Qəzəl',  ru: 'Газель', en: 'Ghazal' },
  { key: 'MASNAVI', az: 'Məsnəvi', ru: 'Маснави', en: 'Masnavi' },
  { key: 'RUBAI',   az: 'Rübai',   ru: 'Рубаи',  en: 'Rubai' },
  { key: 'PROSE',   az: 'Nəsr',    ru: 'Проза',   en: 'Prose' },
  { key: 'PLAY',    az: 'Dram',    ru: 'Драма',   en: 'Drama' },
];

interface FeaturedAuthor {
  slug: string;
  nameAz: string;
  nameRu?: string;
  nameEn?: string;
  bornYear?: number;
  diedYear?: number;
  type: string;
  period?: string;
  portraitUrl?: string;
  bioAz?: string;
  bioRu?: string;
  bioEn?: string;
  _count: { works: number };
}

interface AuthorListItem {
  slug: string;
  nameAz: string;
  nameRu?: string;
  nameEn?: string;
  type: string;
  period?: string;
  _count: { works: number };
}

interface WorkListItem {
  slug: string;
  titleAz: string;
  titleRu?: string;
  genre: string;
  form?: string;
  year?: number;
  author: { slug: string; nameAz: string; nameRu?: string };
  collection?: { slug: string; titleAz: string };
}

function localeName(item: Record<string, any>, locale: string) {
  return localized(item, 'name', locale) ?? '';
}

function localeTitle(item: Record<string, any>, locale: string) {
  return localized(item, 'title', locale) ?? '';
}

function localeBio(item: Record<string, any>, locale: string) {
  return localized(item, 'bio', locale);
}

function genreLabel(genre: string, form: string | undefined, locale: string) {
  const formMap: Record<string, Record<string, string>> = {
    GHAZAL:  { az: 'Qəzəl',  ru: 'Газель',  en: 'Ghazal' },
    MASNAVI: { az: 'Məsnəvi', ru: 'Маснави', en: 'Masnavi' },
    RUBAI:   { az: 'Rübai',   ru: 'Рубаи',   en: 'Rubai' },
    QASIDA:  { az: 'Qəsidə',  ru: 'Касыда',  en: 'Qasida' },
    MURABBA: { az: 'Mürəbbe', ru: 'Мураббаъ', en: 'Murabba' },
  };
  const genreMap: Record<string, Record<string, string>> = {
    POEM:  { az: 'Şeir',    ru: 'Поэзия',  en: 'Poetry' },
    PROSE: { az: 'Nəsr',    ru: 'Проза',   en: 'Prose' },
    PLAY:  { az: 'Dram',    ru: 'Драма',   en: 'Drama' },
    ESSAY: { az: 'Esse',    ru: 'Эссе',    en: 'Essay' },
  };
  const lang = locale === 'ru' ? 'ru' : locale === 'en' ? 'en' : 'az';
  if (form && formMap[form]) return formMap[form][lang];
  return genreMap[genre]?.[lang] ?? genre;
}

function authorTypeMeta(type: string, locale: string) {
  const map: Record<string, Record<string, string>> = {
    POET:        { az: 'Şair',       ru: 'Поэт',       en: 'Poet' },
    WRITER:      { az: 'Yazıçı',     ru: 'Писатель',    en: 'Writer' },
    PLAYWRIGHT:  { az: 'Dramaturq',  ru: 'Драматург',   en: 'Playwright' },
    PHILOSOPHER: { az: 'Filosof',    ru: 'Философ',     en: 'Philosopher' },
  };
  const lang = locale === 'ru' ? 'ru' : locale === 'en' ? 'en' : 'az';
  return map[type]?.[lang] ?? type;
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('home');

  // Fetch data from API in parallel
  const [featured, authorsRes, worksRes] = await Promise.all([
    api.getFeaturedAuthor().catch(() => null) as Promise<FeaturedAuthor | null>,
    api.getAuthors(new URLSearchParams({ limit: '4', sort: 'recent' })) as Promise<{ data: AuthorListItem[] }>,
    api.getWorks(new URLSearchParams({ limit: '6', sort: 'recent' })) as Promise<{ data: WorkListItem[] }>,
  ]);

  const recentAuthors = authorsRes?.data ?? [];
  const recentWorks = worksRes?.data ?? [];

  // Truncate bio to first 2 sentences for the featured box
  const bio = featured ? localeBio(featured, locale) : null;
  const bioSnippet = bio
    ? bio.replace(/\n/g, ' ').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
    : null;

  return (
    <div className="container page-content">
      <div className="home-grid">

        {/* ── Left: Featured author ─────────────────────────── */}
        <div className="home-featured">
          <p className="section-label">{t('featured_label')}</p>

          {featured ? (
            <div className="featured-box">
              <div className="featured-box-inner">
                <h1 style={{ fontSize: '3.25rem', letterSpacing: '-0.04em', fontFamily: 'Georgia, serif' }}>
                  {localeName(featured, locale)}
                </h1>
                <div className="meta-strip" style={{ justifyContent: 'center', marginTop: '0.3rem' }}>
                  {featured.bornYear && featured.diedYear && (
                    <span>{featured.bornYear} — {featured.diedYear}</span>
                  )}
                  {featured.period && (
                    <>
                      {featured.bornYear && <span className="dot" />}
                      <span>{featured.period}</span>
                    </>
                  )}
                  <span className="dot" />
                  <span>{authorTypeMeta(featured.type, locale)}</span>
                </div>

                {bioSnippet && (
                  <p style={{
                    fontStyle: 'italic',
                    color: 'var(--warm-brown)',
                    fontSize: '1rem',
                    lineHeight: 1.9,
                    textAlign: 'left',
                  }}>
                    <span style={{
                      fontFamily: 'Georgia, serif',
                      fontSize: '2.5rem',
                      lineHeight: 0,
                      verticalAlign: '-0.3em',
                      marginRight: '0.15rem',
                      color: 'var(--pomeg)',
                      fontStyle: 'normal',
                    }}>{'\u201C'}</span>
                    {bioSnippet}
                  </p>
                )}

                <Link
                  href={`/${locale}/authors/${featured.slug}`}
                  className="more"
                  style={{
                    display: 'inline-block',
                    marginTop: '0.6rem',
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.78rem',
                    color: 'var(--pomeg)',
                    letterSpacing: '0.03em',
                  }}
                >
                  {t('read_more')} →
                </Link>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>{t('coming_soon')}</p>
          )}
        </div>

        {/* ── Right: Sidebar ────────────────────────────────── */}
        <div className="home-sidebar">
          {/* Recent additions */}
          <div className="home-sidebar-section">
            <p className="section-label">{t('recent_label')}</p>
            {recentAuthors.map((author) => (
              <Link key={author.slug} href={`/${locale}/authors/${author.slug}`} className="recent-item">
                <div className="recent-item-name">{localeName(author, locale)}</div>
                <div className="recent-item-meta">
                  {author.period && <>{author.period} · </>}
                  {authorTypeMeta(author.type, locale)}
                  {author._count.works > 0 && <> · {author._count.works}</>}
                </div>
              </Link>
            ))}
          </div>

          <div className="ornament ornament--diamonds" style={{ margin: '0.5rem 0 1rem' }} />

          {/* Century filter */}
          <div className="home-sidebar-section">
            <p className="section-label">{t('centuries_label')}</p>
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {CENTURIES.map(({ label, y }) => (
                <Link key={label} href={`/${locale}/authors?century=${y}`} className="pill" style={{ minWidth: '2.5rem', textAlign: 'center' }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Genre filter */}
          <div className="home-sidebar-section" style={{ marginTop: '0.75rem' }}>
            <p className="section-label">{t('genres_label')}</p>
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {GENRES.map((g) => (
                <Link key={g.key} href={`/${locale}/works?form=${g.key}`} className="pill">
                  {locale === 'ru' ? g.ru : locale === 'en' ? g.en : g.az}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: Recent works strip ─────────────────────── */}
      {recentWorks.length > 0 && (
        <div className="works-strip">
          <p className="section-label" style={{ padding: '0 0 0.75rem' }}>
            {t('recent_works_label')}
          </p>
          <div className="works-strip-grid">
            {recentWorks.slice(0, 3).map((w) => (
              <div key={w.slug} className="works-strip-col">
                <div className="works-strip-type">
                  {genreLabel(w.genre, w.form ?? undefined, locale)}
                  {w.year ? ` · ${w.year}` : ''}
                </div>
                <Link href={`/${locale}/works/${w.slug}`} className="works-strip-title" style={{ display: 'block' }}>
                  {localeTitle(w, locale)}
                </Link>
                <div className="works-strip-author">
                  {localeName(w.author, locale)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
