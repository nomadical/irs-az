import Link from 'next/link';
import { localized } from '@/lib/locale';
import type { TagRef } from '@/lib/api';

interface Props {
  tags: (TagRef & { works?: number })[];
  locale: string;
  label: string;
  /** Show each tag's work count */
  counts?: boolean;
  className?: string;
}

export function TagPills({ tags, locale, label, counts, className = '' }: Props) {
  if (!tags.length) return null;
  return (
    <ul className={`tag-pills chip-row ${className}`} aria-label={label}>
      {tags.map((tag) => (
        <li key={tag.slug}>
          <Link href={`/${locale}/tags/${tag.slug}`} className="pill tag-pill">
            {localized(tag, 'name', locale)}
            {counts && tag.works !== undefined && <span className="tag-pill-count">{tag.works}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
