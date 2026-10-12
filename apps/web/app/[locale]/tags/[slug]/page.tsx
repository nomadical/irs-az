import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { api, notFoundOn404, type TagDetail } from '@/lib/api';
import { localized } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { WorkCard, type Incipit } from '@/components/works/WorkCard';
import { Pagination } from '@/components/ui/Pagination';
import { notFound } from 'next/navigation';
import { parseTagFacet, tagPath } from '@/lib/facets';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The author named by /tags/<slug>/muellif-<author>; an unknown one is a 404 */
function authorFacet(tag: TagDetail, f: string | string[] | undefined) {
  const { filters, invalid } = parseTagFacet(f);
  if (invalid) notFound();
  if (filters.author && !tag.authors.some((a) => a.slug === filters.author)) notFound();
  return filters.author;
}

interface WorkItem {
  id: string;
  slug: string;
  titleAz: string;
  titleRu: string | null;
  form: string | null;
  year: number | null;
  yearApprox: boolean;
  author: { slug: string; nameAz: string; nameRu: string | null };
  incipit?: Incipit;
}

/** Page heading: the tag alone, or "Author: tag" when narrowed to one author */
function heading(tag: TagDetail, authorSlug: string | undefined, locale: string, byAuthor: (v: object) => string) {
  const name = localized(tag, 'name', locale) ?? tag.nameAz;
  const author = authorSlug ? tag.authors.find((a) => a.slug === authorSlug) : undefined;
  return { name, author, title: author ? byAuthor({ author: localized(author, 'name', locale), tag: name }) : name };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'tags' });
  const tag = await api.getTag(slug).catch(notFoundOn404);
  const { title, author } = heading(tag, authorFacet(tag, sp.f), locale, (v) => t('by_author', v as any));

  return pageMetadata({
    locale,
    path: tagPath(locale, slug, author?.slug, { page: one(sp.page) }).slice(locale.length + 1),
    title,
    description: `${title} — ${t('works_count', { count: author?.works ?? tag.works })}`,
  });
}

export default async function TagPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const sp = await searchParams;
  const t = await getTranslations('tags');
  const options = await getTranslations('contribute.options');

  const tag = await api.getTag(slug).catch(notFoundOn404);
  const { title, author } = heading(tag, authorFacet(tag, sp.f), locale, (v) => t('by_author', v as any));

  const query = new URLSearchParams({ tag: slug, limit: '24', incipit: ['az', 'ru', 'en'].includes(locale) ? locale : 'az' });
  if (author) query.set('authorSlug', author.slug);
  if (one(sp.page)) query.set('page', one(sp.page)!);
  const result = (await api.getWorks(query)) as {
    data: WorkItem[];
    meta: { total: number; page: number; totalPages: number };
  };

  const withAuthor = (authorSlug?: string, page?: number) => tagPath(locale, slug, authorSlug, { page });

  return (
    <div className="container page-content">
      <nav className="breadcrumb" aria-label={t('title')}>
        <Link href={`/${locale}/tags`}>{t('title')}</Link>
        <span className="breadcrumb-sep" aria-hidden="true">›</span>
        <span className="breadcrumb-current" aria-current="page">{title}</span>
      </nav>

      <header className="page-header page-header--start tag-header">
        <h1>{title}</h1>
        <p className="meta-strip">{t('works_count', { count: result.meta.total })}</p>
      </header>

      {tag.authors.length > 1 && (
        <nav className="chip-row tag-authors" aria-label={t('all_authors')}>
          <Link href={withAuthor()} className={`pill ${author ? '' : 'active'}`} aria-current={author ? undefined : 'page'}>
            {t('all_authors')}
          </Link>
          {tag.authors.map((a) => (
            <Link
              key={a.slug}
              href={withAuthor(a.slug)}
              className={`pill ${author?.slug === a.slug ? 'active' : ''}`}
              aria-current={author?.slug === a.slug ? 'page' : undefined}
            >
              {localized(a, 'name', locale)}
              <span className="tag-pill-count">{a.works}</span>
            </Link>
          ))}
        </nav>
      )}

      {result.data.length > 0 ? (
        <div className="card-grid card-grid--3 work-card-grid">
          {result.data.map((work) => {
            const form = work.form && work.form !== 'OTHER' ? options(`form.${work.form}` as any) : null;
            return (
              <WorkCard
                key={work.id}
                href={`/${locale}/works/${work.slug}`}
                title={localized(work, 'title', locale) ?? work.titleAz}
                incipit={work.incipit}
                meta={
                  <>
                    <span>{localized(work.author, 'name', locale)}</span>
                    {form && (
                      <>
                        <span className="dot" aria-hidden="true" />
                        <span>{form}</span>
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
      ) : (
        <p className="empty-note empty-note--center">{t('empty')}</p>
      )}

      <Pagination
        page={result.meta.page}
        totalPages={result.meta.totalPages}
        href={(p) => withAuthor(author?.slug, p)}
        label={t('pages')}
      />

      <p className="tag-note">{t('auto_note')}</p>
    </div>
  );
}
