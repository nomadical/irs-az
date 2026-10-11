'use client';

import Link from 'next/link';
import { CENTURIES } from '@irs-az/shared';

interface Props {
  locale: string;
  current: Record<string, string | undefined>;
}

const authorTypes = [
  { value: 'POET', labelAz: 'Şair', labelRu: 'Поэт', labelEn: 'Poet' },
  { value: 'WRITER', labelAz: 'Yazıçı', labelRu: 'Писатель', labelEn: 'Writer' },
  { value: 'PHILOSOPHER', labelAz: 'Filosof', labelRu: 'Философ', labelEn: 'Philosopher' },
  { value: 'PLAYWRIGHT', labelAz: 'Dramaturq', labelRu: 'Драматург', labelEn: 'Playwright' },
];

export function AuthorFilters({ locale, current }: Props) {
  const buildHref = (key: string, value: string) => {
    const params = new URLSearchParams();
    if (key !== 'type' && current.type) params.set('type', current.type);
    if (key !== 'century' && current.century) params.set('century', current.century);
    params.set(key, value);
    return `/${locale}/authors?${params}`;
  };

  return (
    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
      {/* Type filter */}
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {authorTypes.map((t) => (
          <Link
            key={t.value}
            href={
              current.type === t.value
                ? `/${locale}/authors`
                : buildHref('type', t.value)
            }
            className={`pill ${current.type === t.value ? 'active' : ''}`}
          >
            {locale === 'ru' ? t.labelRu : locale === 'en' ? t.labelEn : t.labelAz}
          </Link>
        ))}
      </div>

      {/* Century filter */}
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
        {CENTURIES.filter((c) => c.value >= 12 && c.value <= 21).map((c) => (
          <Link
            key={c.value}
            href={
              current.century === String(c.value)
                ? `/${locale}/authors`
                : buildHref('century', String(c.value))
            }
            className={`pill ${current.century === String(c.value) ? 'active' : ''}`}
            style={{ fontSize: '0.7rem' }}
          >
            {locale === 'ru' ? c.labelRu : locale === 'en' ? c.labelEn : c.labelAz}
          </Link>
        ))}
      </div>
    </div>
  );
}
