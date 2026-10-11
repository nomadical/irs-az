import type { Metadata } from 'next';
import { getTranslations as getMetaTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';
import { api } from '@/lib/api';
import { localized } from '@/lib/locale';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getMetaTranslations({ locale });

  return pageMetadata({
    locale,
    path: '/blog',
    title: t('nav.blog'),
    description: t('site.description'),
  });
}

export default async function BlogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;

  const query = new URLSearchParams();
  if (sp.page) query.set('page', sp.page);

  const result = (await api.getBlogPosts(query)) as any;

  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <h1
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '2.5rem',
          marginBottom: '1.5rem',
        }}
      >
        ◆ {locale === 'ru' ? 'Блог' : locale === 'en' ? 'Blog' : 'Bloq'}
      </h1>

      <hr className="rule rule--double" />

      {result.data.length === 0 && (
        <p style={{ color: 'var(--muted)', marginTop: '2rem', textAlign: 'center' }}>
          {locale === 'ru'
            ? 'Пока нет записей'
            : locale === 'en'
              ? 'No posts yet'
              : 'Hələ yazı yoxdur'}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '1.5rem',
          marginTop: '2rem',
        }}
      >
        {result.data.map((post: any) => {
          const title = localized(post, 'title', locale);

          return (
            <Link
              key={post.id}
              href={`/${locale}/blog/${post.slug}`}
              style={{
                border: '1px solid var(--rule)',
                padding: '1.5rem',
                textDecoration: 'none',
                color: 'var(--ink)',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.7rem',
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {post.publishedAt
                  ? new Date(post.publishedAt).toLocaleDateString(
                      locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-US' : 'az-AZ',
                    )
                  : ''}
              </p>
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.25rem',
                  marginTop: '0.5rem',
                }}
              >
                {title}
              </h2>
              {post.excerpt && (
                <p
                  style={{
                    fontSize: '0.9rem',
                    color: 'var(--warm-brown)',
                    marginTop: '0.5rem',
                    lineHeight: 1.6,
                  }}
                >
                  {post.excerpt}
                </p>
              )}
              <p
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.75rem',
                  color: 'var(--muted)',
                  marginTop: '0.75rem',
                }}
              >
                {post.author?.name || post.author?.username}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
