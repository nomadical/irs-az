import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { api } from '@/lib/api';
import { localized } from '@/lib/locale';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { WorkCard, type Incipit } from '@/components/works/WorkCard';
import { TagPills } from '@/components/works/TagPills';
import { Pagination } from '@/components/ui/Pagination';
import { notFound, permanentRedirect } from 'next/navigation';
import { notFoundOn404 } from '@/lib/api';
import { parseWorkFacets, worksPath, type WorkFilters } from '@/lib/facets';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface WorkItem {
  id: string;
  slug: string;
  titleAz: string;
  titleRu: string | null;
  genre: string;
  form: string | null;
  year: number | null;
  yearApprox: boolean;
  originalLang: string;
  author: { slug: string; nameAz: string; nameRu: string | null };
  collection: { slug: string; titleAz: string } | null;
  incipit?: Incipit;
}

interface WorksResponse {
  data: WorkItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const FORM_FILTERS = [
  { value: 'GHAZAL',  az: 'Qəzəl',  ru: 'Газель',  en: 'Ghazal' },
  { value: 'MASNAVI', az: 'Məsnəvi', ru: 'Маснави', en: 'Masnavi' },
  { value: 'RUBAI',   az: 'Rübai',   ru: 'Рубаи',   en: 'Rubai' },
  { value: 'QASIDA',  az: 'Qəsidə',  ru: 'Касыда',  en: 'Qasida' },
  { value: 'MURABBA', az: 'Mürəbbe', ru: 'Мураббаъ', en: 'Murabba' },
  { value: 'OTHER',   az: 'Digər',   ru: 'Другое',  en: 'Other' },
];

const GENRE_FILTERS = [
  { value: 'POEM',  az: 'Şeir',  ru: 'Поэзия', en: 'Poetry' },
  { value: 'PROSE', az: 'Nəsr',  ru: 'Проза',  en: 'Prose' },
  { value: 'PLAY',  az: 'Dram',  ru: 'Драма',  en: 'Drama' },
  { value: 'ESSAY', az: 'Esse',  ru: 'Эссе',   en: 'Essay' },
];

function label(item: { az: string; ru: string; en: string }, locale: string) {
  return locale === 'ru' ? item.ru : locale === 'en' ? item.en : item.az;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Filters from the readable path, the author they name, and the page heading */
async function resolveFilters(locale: string, sp: Record<string, string | string[] | undefined>) {
  const { filters, invalid, given } = parseWorkFacets(sp.f);
  if (invalid) notFound();
  const author = filters.author
    ? ((await api.getAuthor(filters.author).catch(notFoundOn404)) as Record<string, any>)
    : null;
  const t = await getTranslations({ locale, namespace: 'works' });
  const genre = GENRE_FILTERS.find((g) => g.value === filters.genre);
  const form = FORM_FILTERS.find((f) => f.value === filters.form);
  const parts = [
    author && (localized(author, 'name', locale) ?? author.nameAz),
    form ? label(form, locale) : genre ? label(genre, locale) : null,
  ].filter(Boolean) as string[];
  return { filters, given, heading: parts.length ? parts.join(' · ') : t('title'), filtered: parts.length > 0 };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale });
  const { filters, heading, filtered } = await resolveFilters(locale, sp);
  const page = Number(one(sp.page)) || 1;

  return pageMetadata({
    locale,
    path: worksPath(locale, filters, { page }).slice(locale.length + 1),
    title: filtered ? `${heading} — ${t('nav.works')}` : t('nav.works'),
    description: t('site.description'),
  });
}

export default async function WorksPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations('works');

  const { filters, given, heading } = await resolveFilters(locale, sp);
  const lang = one(sp.lang);
  // Segments in another order (or a stray ?page=1) redirect to the one canonical URL
  const canonical = worksPath(locale, filters, { lang, page: one(sp.page) });
  const requested = worksPath(locale, {}, { lang, page: one(sp.page) }).replace(
    `/${locale}/works`,
    `/${locale}/works${given.map((g) => `/${g}`).join('')}`,
  );
  if (canonical !== requested) permanentRedirect(canonical);
  const href = (f: WorkFilters, page?: number) => worksPath(locale, f, { lang, page });

  const query = new URLSearchParams();
  if (filters.form) query.set('form', filters.form);
  if (filters.genre) query.set('genre', filters.genre);
  if (filters.author) query.set('authorSlug', filters.author);
  if (lang) query.set('lang', lang);
  if (one(sp.page)) query.set('page', one(sp.page)!);
  query.set('limit', '30');
  query.set('incipit', ['az', 'ru', 'en'].includes(locale) ? locale : 'az');

  const [result, tags] = await Promise.all([
    api.getWorks(query) as Promise<WorksResponse>,
    api.getTags().catch(() => []),
  ]);
  const themes = tags.filter((tag) => tag.kind === 'THEME' && tag.works > 0);
  const tt = await getTranslations('tags');

  const activeForm = filters.form;
  const activeGenre = filters.genre;

  return (
    <div className="container page-content">
      <header className="page-header page-header--start">
        <h1>{heading}</h1>
        {filters.author && (
          <p className="filter-clear">
            <Link href={href({ ...filters, author: undefined })}>← {tt('all_authors')}</Link>
          </p>
        )}
      </header>

      {/* Filters */}
      <div className="filter-bar">
        {/* Genre and form replace each other (a form is a kind of poem); the author stays */}
        <div className="chip-row">
          {GENRE_FILTERS.map((g) => (
            <Link
              key={g.value}
              href={
                activeGenre === g.value
                  ? href({ author: filters.author })
                  : href({ author: filters.author, genre: g.value })
              }
              className={`pill ${activeGenre === g.value ? 'active' : ''}`}
            >
              {label(g, locale)}
            </Link>
          ))}
        </div>

        {/* Form filter (poem sub-genres) */}
        <div className="chip-row">
          {FORM_FILTERS.map((f) => (
            <Link
              key={f.value}
              href={
                activeForm === f.value
                  ? href({ author: filters.author })
                  : href({ author: filters.author, form: f.value })
              }
              className={`pill ${activeForm === f.value ? 'active' : ''}`}
            >
              {label(f, locale)}
            </Link>
          ))}
        </div>
      </div>

      {themes.length > 0 && (
        <div className="works-themes">
          <TagPills tags={themes} locale={locale} label={tt('title')} />
          <Link href={`/${locale}/tags`} className="more works-themes-all">{tt('all_tags')} →</Link>
        </div>
      )}

      <hr className="rule rule--tight" />

      {/* Works list */}
      <div className="card-grid card-grid--3 work-card-grid">
        {result.data.map((work) => {
          const title = localized(work, 'title', locale);
          const authorName = localized(work.author, 'name', locale);

          const form = FORM_FILTERS.find((f) => f.value === work.form && f.value !== 'OTHER');
          return (
            <WorkCard
              key={work.id}
              href={`/${locale}/works/${work.slug}`}
              title={title ?? work.titleAz}
              incipit={work.incipit}
              meta={
                <>
                  <span>{authorName}</span>
                  {form && (
                    <>
                      <span className="dot" aria-hidden="true" />
                      <span>{label(form, locale)}</span>
                    </>
                  )}
                  {work.year && (
                    <>
                      <span className="dot" aria-hidden="true" />
                      <span>{work.yearApprox && '~'}{work.year}</span>
                    </>
                  )}
                </>
              }
            />
          );
        })}
      </div>

      {result.data.length === 0 && (
        <p className="empty-note empty-note--center">
          {locale === 'ru' ? 'Ничего не найдено' : locale === 'en' ? 'No results found' : 'Heç nə tapılmadı'}
        </p>
      )}

      <Pagination
        page={result.meta.page}
        totalPages={result.meta.totalPages}
        href={(page) => href(filters, page)}
        label={tt('pages')}
      />
    </div>
  );
}
