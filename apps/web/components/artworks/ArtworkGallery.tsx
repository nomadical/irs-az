'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { localized } from '@/lib/locale';

export interface Artwork {
  id: string;
  title: string;
  objectDate: string | null;
  medium: string | null;
  artists: string | null;
  imageUrl: string;
  imageSmallUrl: string | null;
  museum: string;
  sourceUrl: string;
  creditLine: string | null;
  license: string;
  collection: { slug: string; titleAz: string; titleRu: string | null; titleEn: string | null } | null;
}

interface Props {
  artworks: Artwork[];
  locale: string;
  /** Name the poem each artwork illustrates (author page); a collection page already says it */
  showCollection?: boolean;
  /** Show this many until the reader asks for all */
  initial?: number;
}

/** "CC BY-NC-SA 3.0" → its deed on creativecommons.org; null for CC0 and anything else */
function licenceUrl(licence: string): string | null {
  const m = licence.match(/^CC (BY(?:-(?:NC|SA|ND))*) (\d\.\d)$/);
  return m ? `https://creativecommons.org/licenses/${m[1].toLowerCase()}/${m[2]}/` : null;
}

/**
 * Wikimedia Commons renders thumbnails itself at standard widths and rate-limits servers that
 * fetch many at once, so its images skip our resizer and load straight from Commons at the
 * size needed. Other museums' images go through next/image.
 */
const isCommons = (url: string) => /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(url);
const commonsWidth = (url: string, width: number) => url.replace(/\/\d+px-/, `/${width}px-`);

/** Strip the catalogue's quotes: "Laila and Majnun at School", Folio … → Laila and Majnun at School, Folio … */
const plainTitle = (title: string) => title.replace(/^"([^"]+)",?/, '$1,').replace(/,$/, '');

export function ArtworkGallery({ artworks, locale, showCollection = false, initial }: Props) {
  const t = useTranslations('gallery');
  const [expanded, setExpanded] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);

  const visible = initial && !expanded ? artworks.slice(0, initial) : artworks;
  const active = current != null ? artworks[current] : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (current != null && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first button (Previous); Close is the expected landing spot
      closeRef.current?.focus();
    }
    if (current == null && dialog.open) dialog.close();
  }, [current]);

  const close = () => {
    const last = current;
    setCurrent(null);
    // Return focus to the thumbnail that opened the viewer
    if (last != null) triggers.current[last]?.focus();
  };
  const step = (delta: number) =>
    setCurrent((i) => (i == null ? i : (i + delta + artworks.length) % artworks.length));

  if (artworks.length === 0) return null;

  return (
    <section className="gallery" aria-labelledby="gallery-heading">
      <h2 id="gallery-heading" className="gallery-heading">
        {t('heading')}
        <span className="gallery-count"> · {artworks.length}</span>
      </h2>

      <ul className="gallery-grid">
        {visible.map((a, i) => (
          <li key={a.id}>
            <figure className="gallery-item">
              <button
                ref={(el) => {
                  triggers.current[i] = el;
                }}
                type="button"
                className="gallery-thumb"
                onClick={() => setCurrent(i)}
                aria-label={t('open', { title: plainTitle(a.title) })}
              >
                <span className="gallery-thumb-frame">
                  {/* Resized by Next.js: museum originals run to a megabyte or more */}
                  {(() => {
                    const src = a.imageSmallUrl ?? a.imageUrl;
                    return isCommons(src) ? (
                      <Image src={commonsWidth(src, 500)} alt="" fill unoptimized />
                    ) : (
                      <Image src={src} alt="" fill sizes="(min-width: 40rem) 12rem, 45vw" />
                    );
                  })()}
                </span>
              </button>
              <figcaption className="gallery-caption">
                <span className="gallery-title" lang="en">
                  {plainTitle(a.title)}
                </span>
                {a.objectDate && <span className="gallery-meta">{a.objectDate}</span>}
                {showCollection && a.collection && (
                  <Link className="gallery-meta gallery-coll" href={`/${locale}/collections/${a.collection.slug}`}>
                    {localized(a.collection, 'title', locale)}
                  </Link>
                )}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>

      <div className="gallery-foot">
        {initial != null && artworks.length > initial && (
          <button type="button" className="pill pill--ghost gallery-more" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
            {expanded ? t('show_less') : t('show_all', { count: artworks.length })}
          </button>
        )}
        {locale !== 'en' && <p className="gallery-note">{t('titles_note')}</p>}
      </div>

      <dialog
        ref={dialogRef}
        className="lightbox"
        aria-labelledby="lightbox-title"
        onClose={() => current != null && close()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') step(1);
          if (e.key === 'ArrowLeft') step(-1);
        }}
        // A click on the backdrop lands on the dialog element itself
        onClick={(e) => e.target === e.currentTarget && close()}
      >
        {active && (
          <div className="lightbox-body">
            <div className="lightbox-image">
              <Image
                src={active.imageSmallUrl ?? active.imageUrl}
                alt=""
                width={1200}
                height={1500}
                sizes="(min-width: 60rem) 48rem, 100vw"
                unoptimized={isCommons(active.imageSmallUrl ?? active.imageUrl)}
              />
            </div>

            <div className="lightbox-info">
              <div className="lightbox-bar">
                <span className="lightbox-counter">
                  {t('counter', { n: current! + 1, total: artworks.length })}
                </span>
                <span className="lightbox-nav">
                  <button type="button" onClick={() => step(-1)} aria-label={t('previous')}>←</button>
                  <button type="button" onClick={() => step(1)} aria-label={t('next')}>→</button>
                  <button ref={closeRef} type="button" onClick={close} aria-label={t('close')}>×</button>
                </span>
              </div>

              <h3 id="lightbox-title" className="lightbox-title" lang="en">
                {plainTitle(active.title)}
              </h3>
              <ul className="lightbox-details" lang="en">
                {active.objectDate && <li>{active.objectDate}</li>}
                {active.artists && <li>{active.artists}</li>}
                {active.medium && <li>{active.medium}</li>}
                {active.creditLine && <li className="lightbox-credit">{active.creditLine}</li>}
              </ul>

              {active.collection && showCollection && (
                <p>
                  <Link href={`/${locale}/collections/${active.collection.slug}`} onClick={close}>
                    {localized(active.collection, 'title', locale)}
                  </Link>
                </p>
              )}

              <p className="lightbox-links">
                <a href={active.sourceUrl} target="_blank" rel="noopener">
                  {t('view_at', { museum: active.museum })} ↗
                </a>
                <a href={active.imageUrl} target="_blank" rel="noopener">
                  {t('full_size')} ↗
                </a>
              </p>
              <p className="lightbox-license">
                {active.license === 'CC0' ? (
                  t('public_domain')
                ) : active.license === 'Public domain' ? (
                  // Out of copyright by age (Commons' PD-Art), not dedicated by the museum as CC0
                  t('public_domain_mark')
                ) : licenceUrl(active.license) ? (
                  // Attribution licences ask for the licence to be indicated: link its deed
                  <a href={licenceUrl(active.license)!} target="_blank" rel="noopener license">
                    {active.license} ↗
                  </a>
                ) : (
                  active.license
                )}
              </p>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
