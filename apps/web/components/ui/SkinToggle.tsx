'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Skin = 'gazette' | 'clean';

export function SkinToggle() {
  const t = useTranslations('skin');
  const [skin, setSkin] = useState<Skin>('gazette');

  useEffect(() => {
    setSkin(document.documentElement.getAttribute('data-skin') === 'clean' ? 'clean' : 'gazette');
  }, []);

  const toggle = () => {
    const next: Skin = skin === 'clean' ? 'gazette' : 'clean';
    setSkin(next);
    const root = document.documentElement;
    if (next === 'clean') root.setAttribute('data-skin', 'clean');
    else root.removeAttribute('data-skin');
    try {
      localStorage.setItem('skin', next);
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-btn skin-btn"
      aria-label={t('clean')}
      aria-pressed={skin === 'clean'}
      title={t(skin === 'clean' ? 'gazette' : 'clean')}
    >
      {/* A page with its header band: "page look", not a menu */}
      <svg className="icon" aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="3" width="13" height="14" rx="2" />
        <path d="M3.5 7h13" />
        <path d="M6.5 10.5h7M6.5 13.5h4.5" strokeWidth="1.3" />
      </svg>
    </button>
  );
}
