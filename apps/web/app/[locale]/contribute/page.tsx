import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import { loadPage } from '@/lib/content';
import { localized } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { ContributeForm, type AuthorOption, type WorkOption } from '@/components/contribute/ContributeForm';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string; work?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contribute' });

  return pageMetadata({ locale, path: '/contribute', title: t('title'), description: t('intro') });
}

export default async function ContributePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { type, work: workSlug } = await searchParams;
  const [t, guide] = await Promise.all([
    getTranslations({ locale, namespace: 'contribute' }),
    loadPage('contribute-guide', locale),
  ]);

  // "Suggest a translation" links from a work page arrive with ?type=translation&work=<slug>
  const [authorsRes, work] = await Promise.all([
    api.getAuthors(new URLSearchParams({ limit: '100' })) as Promise<{ data: any[] }>,
    workSlug ? (api.getWork(workSlug).catch(() => null) as Promise<any>) : null,
  ]);

  const authors: AuthorOption[] = authorsRes.data
    .map((a) => ({ id: a.id, slug: a.slug, name: localized(a, 'name', locale) ?? a.nameAz }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  const initialWork: WorkOption | null = work
    ? { id: work.id, title: work.titleAz, authorName: work.author.nameAz }
    : null;

  return (
    <div className="container page-content">
      <header className="page-header">
        <h1>{t('title')}</h1>
      </header>
      <div className="ornament" />
      <div className="contribute-column">
        <p className="contribute-intro">{t('intro')}</p>
        <details className="contribute-guide">
          <summary>{guide.title}</summary>
          <div className="page-prose" dangerouslySetInnerHTML={{ __html: guide.html }} />
        </details>
        <ContributeForm
          authors={authors}
          initialKind={type === 'translation' || initialWork ? 'TRANSLATION' : type === 'author' ? 'AUTHOR' : 'WORK'}
          initialWork={initialWork}
        />
      </div>
    </div>
  );
}
