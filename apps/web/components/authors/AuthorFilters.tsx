'use client';

import Link from 'next/link';
import { CENTURIES } from '@irs-az/shared';
import { authorsPath, type AuthorFilters as Filters } from '@/lib/facets';

interface Props {
  locale: string;
  current: Filters;
}

const authorTypes = [
  { value: 'POET', labelAz: 'Şair', labelRu: 'Поэт', labelEn: 'Poet' },
  { value: 'WRITER', labelAz: 'Yazıçı', labelRu: 'Писатель', labelEn: 'Writer' },
  { value: 'PHILOSOPHER', labelAz: 'Filosof', labelRu: 'Философ', labelEn: 'Philosopher' },
  { value: 'PLAYWRIGHT', labelAz: 'Dramaturq', labelRu: 'Драматург', labelEn: 'Playwright' },
];

export function AuthorFilters({ locale, current }: Props) {

  return (
    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
      {/* Type filter */}
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {authorTypes.map((t) => (
          <Link
            key={t.value}
            href={authorsPath(locale, { ...current, type: current.type === t.value ? undefined : t.value })}
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
            href={authorsPath(locale, { ...current, century: current.century === c.value ? undefined : c.value })}
            className={`pill ${current.century === c.value ? 'active' : ''}`}
            style={{ fontSize: '0.7rem' }}
          >
            {locale === 'ru' ? c.labelRu : locale === 'en' ? c.labelEn : c.labelAz}
          </Link>
        ))}
      </div>
    </div>
  );
}
