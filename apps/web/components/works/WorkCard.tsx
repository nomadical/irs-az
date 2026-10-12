import Link from 'next/link';
import type { ReactNode } from 'react';
import { isArabicScript, langTag } from '@/lib/verse';

export interface Incipit {
  lines: string[];
  /** Language enum of the lines: a translation in the reader's language, or the original */
  lang: string;
}

/** Opening lines of a work, tagged by the script actually present */
export function IncipitLines({ incipit }: { incipit: Incipit }) {
  if (!incipit.lines.length) return null;
  const arabic = isArabicScript(incipit.lines.join(' '));
  const tag = langTag[incipit.lang] ?? undefined;
  // Some imports are tagged Arabic-script but hold a Latin transliteration
  const lang = !arabic && ['AZ_ARABIC', 'FA', 'AR'].includes(incipit.lang) ? `${tag?.split('-')[0]}-Latn` : tag;
  return (
    <p className="incipit" lang={lang} dir={arabic ? 'rtl' : 'ltr'}>
      {incipit.lines.map((line, i) => (
        <span key={i} className="incipit-line">{line}</span>
      ))}
    </p>
  );
}

interface Props {
  href: string;
  title: string;
  incipit?: Incipit | null;
  meta?: ReactNode;
}

export function WorkCard({ href, title, incipit, meta }: Props) {
  const titleArabic = isArabicScript(title);
  return (
    <Link href={href} className="card-item work-card">
      <span className="work-card-title" {...(titleArabic && { lang: 'fa', dir: 'rtl' })}>{title}</span>
      {incipit && <IncipitLines incipit={incipit} />}
      {meta && <span className="meta-strip work-card-meta">{meta}</span>}
    </Link>
  );
}
