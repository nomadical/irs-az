import type { Metadata } from 'next';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { api, type PoemOfTheDay } from '../../lib/api';
import { localized } from '@/lib/locale';
import { TagPills } from '@/components/works/TagPills';
import { CatalogTiles } from '@/components/home/CatalogTiles';
import { RefreshIcon } from '@/components/ui/RefreshIcon';
import { authorsPath, worksPath } from '@/lib/facets';

export const dynamic = 'force-dynamic';

const CENTURIES = [
  { label: 'XI', y: 11 }, { label: 'XII', y: 12 }, { label: 'XIII', y: 13 },
  { label: 'XVI', y: 16 }, { label: 'XVII', y: 17 }, { label: 'XIX', y: 19 },
  { label: 'XX', y: 20 },
];

// Poem forms and prose genres side by side; each links to its own filter
const GENRES = [
  { filter: { form: 'GHAZAL' },  az: 'Qəzəl',  ru: 'Газель', en: 'Ghazal' },
  { filter: { form: 'MASNAVI' }, az: 'Məsnəvi', ru: 'Маснави', en: 'Masnavi' },
  { filter: { form: 'RUBAI' },   az: 'Rübai',   ru: 'Рубаи',  en: 'Rubai' },
  { filter: { genre: 'PROSE' },  az: 'Nəsr',    ru: 'Проза',   en: 'Prose' },
  { filter: { genre: 'PLAY' },   az: 'Dram',    ru: 'Драма',   en: 'Drama' },
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

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });

  return pageMetadata({ locale, path: '', title: t('title'), description: t('description'), absoluteTitle: true });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('home');

  // Fetch data from API in parallel
  const [featured, daily, authorsRes, worksRes, tags, catalog] = await Promise.all([
    api.getFeaturedAuthor().catch(() => null) as Promise<FeaturedAuthor | null>,
    api.getPoemOfTheDay().catch(() => null) as Promise<PoemOfTheDay | null>,
    api.getAuthors(new URLSearchParams({ limit: '4', sort: 'recent' })) as Promise<{ data: AuthorListItem[] }>,
    api.getWorks(new URLSearchParams({ limit: '6', sort: 'recent' })) as Promise<{ data: WorkListItem[] }>,
    api.getTags().catch(() => []),
    api.getCatalog().catch(() => null),
  ]);
  const themes = tags.filter((tag) => tag.kind === 'THEME' && tag.works > 0).slice(0, 8);

  const recentAuthors = authorsRes?.data ?? [];
  const recentWorks = worksRes?.data ?? [];

  // Truncate bio to first 2 sentences for the featured box
  const bio = featured ? localeBio(featured, locale) : null;
  const bioSnippet = bio
    ? bio.replace(/\n/g, ' ').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
    : null;

  return (
    <div className="container page-content">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'IRS.AZ',
          url: `${SITE_URL}/${locale}`,
          inLanguage: locale,
        }}
      />
      <div className="home-grid">

        {/* ── Left: Featured author ─────────────────────────── */}
        <div className="home-featured">
          <p className="section-label">{t('featured_label')}</p>

          {featured ? (
            <div className="featured-box">
              <div className="featured-box-inner">
                <h1 className="featured-name">
                  {localeName(featured, locale)}
                </h1>
                <div className="meta-strip featured-meta">
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
                  // The drop cap only takes a letter: a bio opening on a year would split it
                  <p className={`featured-bio${/^\p{L}/u.test(bioSnippet) ? ' featured-bio--dropcap' : ''}`}>
                    <span className="featured-quote" aria-hidden="true">{'\u201C'}</span>
                    {bioSnippet}
                  </p>
                )}

                <Link
                  href={`/${locale}/authors/${featured.slug}`}
                  className="more featured-more"
                >
                  {t('read_more')} →
                </Link>
              </div>
            </div>
          ) : (
            <p className="empty-note">{t('coming_soon')}</p>
          )}

          {/* Poem of the day sits under the poet, so the column ends level with the sidebar */}
        {daily && (
          <section className="daily-poem" aria-labelledby="daily-poem-title">
            <p className="section-label">{t('daily_label')}</p>
            <h2 id="daily-poem-title" className="daily-poem-title">
              <Link href={`/${locale}/works/${daily.slug}`}>{localeTitle(daily, locale)}</Link>
            </h2>
            <div className="daily-poem-author">
              <Link href={`/${locale}/authors/${daily.author.slug}`}>{localeName(daily.author, locale)}</Link>
              {daily.year ? ` · ${daily.year}` : ''}
            </div>
            <blockquote className="daily-poem-excerpt" lang="az-Latn">
              {daily.excerpt.map((line, i) => <p key={i}>{line}</p>)}
            </blockquote>
            <div className="daily-poem-actions">
              <Link href={`/${locale}/works/${daily.slug}`} className="more">{t('read_full')} →</Link>
              <Link href={`/${locale}/random`} prefetch={false} className="more"><RefreshIcon /> {t('random_poem')}</Link>
            </div>
          </section>
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

          <div className="ornament ornament--diamonds home-sidebar-orn" aria-hidden="true" />

          {themes.length > 0 && (
            <div className="home-sidebar-section">
              <p className="section-label">{t('themes_label')}</p>
              <TagPills tags={themes} locale={locale} label={t('themes_label')} />
            </div>
          )}

          {/* Century filter */}
          <div className="home-sidebar-section">
            <p className="section-label">{t('centuries_label')}</p>
            <div className="chip-row">
              {CENTURIES.map(({ label, y }) => (
                <Link key={label} href={authorsPath(locale, { century: y })} className="pill pill--century">
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Genre filter */}
          <div className="home-sidebar-section">
            <p className="section-label">{t('genres_label')}</p>
            <div className="chip-row">
              {GENRES.map((g) => (
                <Link key={g.en} href={worksPath(locale, g.filter)} className="pill">
                  {locale === 'ru' ? g.ru : locale === 'en' ? g.en : g.az}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Poem of the day ──────────────────────────────── */}
      {catalog && (
        <CatalogTiles
          catalog={catalog}
          themes={tags.filter((tag) => tag.kind === 'THEME' && tag.works > 0).length}
          locale={locale}
        />
      )}

      {/* ── Bottom: Recent works strip ─────────────────────── */}
      {recentWorks.length > 0 && (
        <div className="works-strip">
          <p className="section-label">
            {t('recent_works_label')}
          </p>
          <div className="works-strip-grid">
            {recentWorks.slice(0, 3).map((w) => (
              <div key={w.slug} className="works-strip-col">
                <div className="works-strip-type">
                  {genreLabel(w.genre, w.form ?? undefined, locale)}
                  {w.year ? ` · ${w.year}` : ''}
                </div>
                <Link href={`/${locale}/works/${w.slug}`} className="works-strip-title">
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
