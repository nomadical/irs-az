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
      <span className="glyph" aria-hidden="true">¶</span>
      <svg className="icon" aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M4 5.5h12M4 10h12M4 14.5h7" />
      </svg>
    </button>
  );
}
