'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  slug: string;
  /** The element holding the text whose progress is shown */
  targetId: string;
  dir: 'ltr' | 'rtl';
}

const KEY = (slug: string) => `irs-reading-pos:${slug}`;
// Too short to need a bar: under this many screens of text
const MIN_SCREENS = 1.5;
// A saved place this close to either end isn't worth offering
const EDGE = 0.05;

function readSaved(slug: string): number | null {
  try {
    const value = Number(localStorage.getItem(KEY(slug)));
    return value > EDGE && value < 1 - EDGE ? value : null;
  } catch {
    return null;
  }
}

function save(slug: string, progress: number) {
  try {
    if (progress >= 1 - EDGE) localStorage.removeItem(KEY(slug));
    else if (progress > EDGE) localStorage.setItem(KEY(slug), progress.toFixed(3));
  } catch {
    // Storage blocked: the bar still works, only the place isn't remembered
  }
}

/** Where the reader is in a long text, a thin bar along the top of the window,
    and an offer to go back to the place they left last time */
export function ReadingProgress({ slug, targetId, dir }: Props) {
  const t = useTranslations('reading');
  const [progress, setProgress] = useState(0);
  const [long, setLong] = useState(false);
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const lastSaved = useRef(0);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    const span = () => {
      const top = target.getBoundingClientRect().top + window.scrollY;
      return { top, length: Math.max(1, target.offsetHeight - window.innerHeight) };
    };
    const progressOf = () => {
      const { top, length } = span();
      return Math.min(1, Math.max(0, (window.scrollY - top) / length));
    };

    let frame = 0;
    const measure = () => {
      frame = 0;
      setLong(target.offsetHeight > window.innerHeight * MIN_SCREENS);
      const p = progressOf();
      setProgress(p);
      // Once they read on, the offer to jump back has done its job
      if (p > EDGE) setResumeAt(null);
      const now = Date.now();
      if (now - lastSaved.current > 1000) {
        lastSaved.current = now;
        save(slug, p);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    const saved = readSaved(slug);
    if (saved !== null && window.scrollY < span().top) setResumeAt(saved);
    measure();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const onHide = () => save(slug, progressOf());
    window.addEventListener('pagehide', onHide);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pagehide', onHide);
      save(slug, progressOf());
    };
  }, [slug, targetId]);

  function resume() {
    const target = document.getElementById(targetId);
    if (!target || resumeAt === null) return;
    const top = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + resumeAt * Math.max(1, target.offsetHeight - window.innerHeight) });
    setResumeAt(null);
    target.focus({ preventScroll: true });
  }

  return (
    <>
      {long && (
        <div className="reading-progress" aria-hidden="true" dir={dir}>
          <div className="reading-progress-bar" style={{ '--progress': progress } as CSSProperties} />
        </div>
      )}
      {resumeAt !== null && (
        <div className="resume">
          <button type="button" className="resume-btn" onClick={resume}>
            {t('resume', { percent: Math.round(resumeAt * 100) })}
          </button>
        </div>
      )}
    </>
  );
}
