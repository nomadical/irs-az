import { api } from '@/lib/api';
import { localized } from '@/lib/locale';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  const post = (await api.getBlogPost(slug)) as any;

  const title = localized(post, 'title', locale);
  const body = localized(post, 'body', locale) ?? '';

  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <nav
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.8rem',
          marginBottom: '1rem',
        }}
      >
        <Link
          href={`/${locale}/blog`}
          style={{ color: 'var(--muted)', textDecoration: 'none' }}
        >
          ← {locale === 'ru' ? 'Блог' : locale === 'en' ? 'Blog' : 'Bloq'}
        </Link>
      </nav>

      <article className="reading-column">
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.75rem',
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {post.publishedAt &&
              new Date(post.publishedAt).toLocaleDateString(
                locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-US' : 'az-AZ',
              )}
          </p>
          <h1
            style={{
              fontSize: '2.5rem',
              fontFamily: 'var(--font-serif)',
              marginTop: '0.5rem',
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.8rem',
              color: 'var(--muted)',
              marginTop: '0.5rem',
            }}
          >
            {post.author?.name || post.author?.username}
          </p>
        </header>

        <div className="ornament" />

        <div dangerouslySetInnerHTML={{ __html: body }} />
      </article>
    </div>
  );
}
