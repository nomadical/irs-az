'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

/** The imprint line: the masthead again, what the site is, and where to write */
export function Footer() {
  const t = useTranslations('site');
  const nav = useTranslations('nav');
  const { locale } = useParams<{ locale: string }>();

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <Link href={`/${locale}`} className="footer-mark">
          IRS<span className="logo-orn" aria-hidden="true">◆</span><em>AZ</em>
        </Link>
        <p className="footer-text">{t('description')}</p>
        <nav className="footer-links" aria-label={t('name')}>
          <Link href={`/${locale}/about`}>{nav('about')}</Link>
          <Link href={`/${locale}/contribute`}>{nav('contribute')}</Link>
          <Link href={`/${locale}/contact`}>{nav('contact')}</Link>
        </nav>
      </div>
    </footer>
  );
}
