'use client';

import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('site');

  return (
    <footer className="footer">
      <div className="container">
        <div className="ornament ornament--small" />
        <p className="footer-text" style={{ marginTop: '1rem' }}>
          {t('name')} — {t('description')}
        </p>
      </div>
    </footer>
  );
}
