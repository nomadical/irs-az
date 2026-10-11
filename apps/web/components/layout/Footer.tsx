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
        <p className="footer-text" style={{ marginTop: '1rem' }}>
          {t('name')} — {t('description')}
        </p>
        <p className="footer-links">
          <Link href={`/${locale}/contribute`}>{nav('contribute')}</Link>
        </p>
      </div>
    </footer>
  );
}
