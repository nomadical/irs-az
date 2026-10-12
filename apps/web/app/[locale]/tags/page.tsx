import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { api, type TagKind } from '@/lib/api';
import { pageMetadata } from '@/lib/seo';
import { TagPills } from '@/components/works/TagPills';

export const dynamic = 'force-dynamic';

const KINDS: TagKind[] = ['THEME', 'MOOD', 'AUDIENCE', 'ERA'];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tags' });
  return pageMetadata({ locale, path: '/tags', title: t('title'), description: t('index_description') });
}

export default async function TagsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations('tags');
  const tags = (await api.getTags()).filter((tag) => tag.works > 0);

  return (
    <div className="container page-content">
      <header className="page-header page-header--start">
        <h1>{t('title')}</h1>
      </header>

      {KINDS.map((kind) => {
        const ofKind = tags.filter((tag) => tag.kind === kind);
        if (!ofKind.length) return null;
        return (
          <section key={kind} className="tag-group" aria-labelledby={`tags-${kind}`}>
            <h2 id={`tags-${kind}`} className="tag-group-title">{t(`kind_${kind}`)}</h2>
            <TagPills tags={ofKind} locale={locale} label={t(`kind_${kind}`)} counts />
          </section>
        );
      })}

      <p className="tag-note">{t('auto_note')}</p>
    </div>
  );
}
