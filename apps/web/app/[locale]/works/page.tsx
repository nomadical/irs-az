import { api } from '@/lib/api';
import { localized } from '@/lib/locale';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

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

  const result = (await api.getWorks(query)) as WorksResponse;

  const activeForm = sp.form;
  const activeGenre = sp.genre;

  return (
    <div className="container page-content">
      <header className="page-header" style={{ textAlign: 'left', paddingTop: 0 }}>
        <p className="section-label">
          {t('title')}
        </p>
        <h1>{t('title')}</h1>
      </header>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* Genre filter */}
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
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
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
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

      <hr className="rule" style={{ margin: '1rem 0' }} />

      {/* Works list */}
      <div className="card-grid card-grid--3">
        {result.data.map((work) => {
          const title = localized(work, 'title', locale);
          const authorName = localized(work.author, 'name', locale);

          return (
            <Link
              key={work.id}
              href={`/${locale}/works/${work.slug}`}
              className="card-item"
            >
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', fontWeight: 600 }}>
                {title}
              </span>
              <div className="meta-strip" style={{ marginTop: '0.3rem' }}>
                <span>{authorName}</span>
                {work.year && (
                  <>
                    <span className="dot" />
                    <span>{work.yearApprox && '~'}{work.year}</span>
                  </>
                )}
                {work.form && (
                  <>
                    <span className="dot" />
                    <span style={{ textTransform: 'lowercase' }}>{work.form}</span>
                  </>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {result.data.length === 0 && (
        <p style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '2rem', fontStyle: 'italic' }}>
          {locale === 'ru' ? 'Ничего не найдено' : locale === 'en' ? 'No results found' : 'Heç nə tapılmadı'}
        </p>
      )}

      {/* Pagination */}
      {result.meta.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem', marginTop: '2rem' }}>
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
              >
                {page}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
