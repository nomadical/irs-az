import { getTranslations } from 'next-intl/server';
import { isPublicDomain, DOWNLOAD_FORMATS, type AuthorLifespan } from '@irs-az/shared';
import { downloadUrl } from '@/lib/api';

interface Props {
  /** API path of the thing to download, e.g. `/works/fuzuli-qezel-7` */
  path: string;
  author: AuthorLifespan;
  locale: string;
  /** What is downloaded, for the group's accessible name */
  kind: 'work' | 'collection' | 'author';
}

const ICON = (
  <svg className="download-icon" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
  </svg>
);

/**
 * EPUB and TXT downloads of the original text. Rendered only for public-domain authors
 * (life + 70, see isPublicDomain); the API enforces the same rule.
 */
export async function DownloadBar({ path, author, locale, kind }: Props) {
  if (!isPublicDomain(author)) return null;
  const t = await getTranslations({ locale, namespace: 'download' });

  return (
    <div className="download-bar" role="group" aria-label={t(kind)}>
      <span className="download-label">{t('label')}</span>
      {DOWNLOAD_FORMATS.map((format) => (
        <a
          key={format}
          className="download-btn"
          href={downloadUrl(path, format)}
          download
          rel="nofollow"
          title={t(format)}
          aria-label={`${t(kind)}: ${t(format)}`}
        >
          {ICON}
          {format.toUpperCase()}
        </a>
      ))}
      <span className="download-note">{t('note')}</span>
    </div>
  );
}
