'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { locales } from '@/lib/i18n';

const labels: Record<string, string> = {
  az: 'AZ',
  ru: 'RU',
  en: 'EN',
};

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();

  const switchLocale = (newLocale: string) => {
    const segments = pathname.split('/');
    segments[1] = newLocale;
    // Keep the query, so a search (?q=) or a chosen translation (?tr=) survives the switch
    router.push(segments.join('/') + window.location.search);
  };

  return (
    <div className="lang-switcher">
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => switchLocale(loc)}
          className={`lang-btn ${loc === currentLocale ? 'active' : ''}`}
          aria-current={loc === currentLocale ? 'true' : undefined}
        >
          {labels[loc]}
        </button>
      ))}
    </div>
  );
}
