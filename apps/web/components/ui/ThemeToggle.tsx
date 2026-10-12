'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export function ThemeToggle() {
  const t = useTranslations('theme');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // The pre-paint script in app/layout.tsx already chose: the stored theme, else the OS's.
    // Adopt it rather than writing a default, which would flip dark-OS visitors to light.
    const root = document.documentElement;
    setTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

    // Until the reader picks one, keep following the OS as it changes
    const os = matchMedia('(prefers-color-scheme: dark)');
    const follow = (e: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem('theme')) return;
      } catch {}
      const next = e.matches ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      setTheme(next);
    };
    os.addEventListener('change', follow);
    return () => os.removeEventListener('change', follow);
  }, []);

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      className="theme-btn"
      aria-label={t('toggle')}
      aria-pressed={theme === 'dark'}
      title={t(theme === 'light' ? 'dark' : 'light')}
    >
      <span className="glyph" aria-hidden="true">{theme === 'light' ? '◑' : '◐'}</span>
      <svg className="icon" aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {theme === 'light' ? (
          <path d="M16 12.2A6.5 6.5 0 0 1 7.8 4a6.5 6.5 0 1 0 8.2 8.2Z" />
        ) : (
          <>
            <circle cx="10" cy="10" r="3.4" />
            <path d="M10 2.5v1.6M10 15.9v1.6M2.5 10h1.6M15.9 10h1.6M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M4.7 15.3l1.1-1.1M14.2 5.8l1.1-1.1" />
          </>
        )}
      </svg>
    </button>
  );
}
