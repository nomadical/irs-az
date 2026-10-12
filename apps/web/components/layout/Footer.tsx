'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('site');
  const nav = useTranslations('nav');
  const { locale } = useParams<{ locale: string }>();

  return (
    <footer className="footer">
      <div className="container">
        <div className="ornament ornament--small" />
        <p className="footer-text">
          {t('name')} — {t('description')}
        </p>
        <nav className="footer-links" aria-label={t('name')}>
          <Link href={`/${locale}/about`}>{nav('about')}</Link>
          <Link href={`/${locale}/contribute`}>{nav('contribute')}</Link>
          <Link href={`/${locale}/contact`}>{nav('contact')}</Link>
        </nav>
      </div>
    </footer>
  );
}
