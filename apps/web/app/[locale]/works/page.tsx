import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { api } from '@/lib/api';
import { localized } from '@/lib/locale';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { WorkCard, type Incipit } from '@/components/works/WorkCard';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
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

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return pageMetadata({
    locale,
    path: '/works',
    title: t('nav.works'),
    description: t('site.description'),
  });
}

export default async function WorksPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations('works');

  const query = new URLSearchParams();
  if (sp.form) query.set('form', sp.form);
  if (sp.genre) query.set('genre', sp.genre);
  if (sp.lang) query.set('lang', sp.lang);
  if (sp.authorSlug) query.set('authorSlug', sp.authorSlug);
  if (sp.page) query.set('page', sp.page);
  query.set('limit', '30');
  query.set('incipit', ['az', 'ru', 'en'].includes(locale) ? locale : 'az');

  const result = (await api.getWorks(query)) as WorksResponse;

  const activeForm = sp.form;
  const activeGenre = sp.genre;

  return (
    <div className="container page-content">
      <header className="page-header page-header--start">
        <h1>{t('title')}</h1>
      </header>

      {/* Filters */}
      <div className="filter-bar">
        {/* Genre filter */}
        <div className="chip-row">
          {GENRE_FILTERS.map((g) => (
            <Link
              key={g.value}
              href={
                activeGenre === g.value
                  ? `/${locale}/works`
                  : `/${locale}/works?genre=${g.value}`
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
                  ? `/${locale}/works`
                  : `/${locale}/works?form=${f.value}`
              }
              className={`pill ${activeForm === f.value ? 'active' : ''}`}
            >
              {label(f, locale)}
            </Link>
          ))}
        </div>
      </div>

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

      {/* Pagination */}
      {result.meta.totalPages > 1 && (
        <nav className="pagination" aria-label={locale === 'ru' ? 'Страницы' : locale === 'en' ? 'Pages' : 'Səhifələr'}>
          {Array.from(
            { length: Math.min(result.meta.totalPages, 10) },
            (_, i) => {
              // Show pages around current page
              const current = result.meta.page;
              const total = result.meta.totalPages;
              if (total <= 10) return i + 1;
              const start = Math.max(1, Math.min(current - 4, total - 9));
              return start + i;
            },
          ).map((page) => {
            const qp = new URLSearchParams();
            if (activeForm) qp.set('form', activeForm);
            if (activeGenre) qp.set('genre', activeGenre);
            if (sp.authorSlug) qp.set('authorSlug', sp.authorSlug);
            qp.set('page', String(page));
            return (
              <Link
                key={page}
                href={`/${locale}/works?${qp}`}
                className={`pill ${page === result.meta.page ? 'active' : ''}`}
                aria-current={page === result.meta.page ? 'page' : undefined}
              >
                {page}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
