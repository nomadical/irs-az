import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { loadPage } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const page = await loadPage('contact', locale);
  return pageMetadata({ locale, path: '/contact', title: page.title, description: page.description });
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  const [page, t] = await Promise.all([
    loadPage('contact', locale),
    getTranslations({ locale, namespace: 'contact' }),
  ]);
  // Set on the server once the domain mailbox exists (deploy/.env)
  const email = process.env.CONTACT_EMAIL;

  return (
    <div className="container page-content">
      <header className="page-header">
        <h1>{page.title}</h1>
      </header>
      <div className="ornament" />
      <div className="page-prose">
        <div className="contact-email">
          <span className="section-label">{t('email_label')}</span>
          {email ? (
            <a href={`mailto:${email}`}>{email}</a>
          ) : (
            <p>
              <Link href={`/${locale}/contribute`}>{t('email_soon')}</Link>
            </p>
          )}
        </div>
        <div dangerouslySetInnerHTML={{ __html: page.html }} />
      </div>
    </div>
  );
}
