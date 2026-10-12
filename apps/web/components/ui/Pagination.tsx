import Link from 'next/link';

interface Props {
  page: number;
  totalPages: number;
  href: (page: number) => string;
  label: string;
}

/** Up to ten page links around the current one */
export function Pagination({ page, totalPages, href, label }: Props) {
  if (totalPages <= 1) return null;
  const start = totalPages <= 10 ? 1 : Math.max(1, Math.min(page - 4, totalPages - 9));
  const pages = Array.from({ length: Math.min(totalPages, 10) }, (_, i) => start + i);

  return (
    <nav className="pagination" aria-label={label}>
      {pages.map((p) => (
        <Link
          key={p}
          href={href(p)}
          className={`pill ${p === page ? 'active' : ''}`}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </Link>
      ))}
    </nav>
  );
}
