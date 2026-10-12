'use client';

import { useEffect, useState, type RefObject } from 'react';

/** Scroll distance that counts as a deliberate direction change */
const THRESHOLD = 8;

/**
 * True while the reader scrolls down past the element, false again on any
 * scroll back up or when focus moves into it (so keyboard users can reach it)
 */
export function useHideOnScroll(ref: RefObject<HTMLElement | null>): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - lastY;
      if (Math.abs(delta) < THRESHOLD) return;
      lastY = y;
      setHidden(delta > 0 && y > (ref.current?.offsetHeight ?? 0));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    const onFocus = () => setHidden(false);

    const el = ref.current;
    window.addEventListener('scroll', onScroll, { passive: true });
    el?.addEventListener('focusin', onFocus);
    return () => {
      window.removeEventListener('scroll', onScroll);
      el?.removeEventListener('focusin', onFocus);
      cancelAnimationFrame(frame);
    };
  }, [ref]);

  return hidden;
}
