'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import { locales } from '@/lib/i18n';

const labels: Record<string, string> = {
  az: 'AZ',
  ru: 'RU',
  en: 'EN',
};

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale: currentLocale } = useParams<{ locale: string }>();

  const switchLocale = (newLocale: string) => {
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
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
