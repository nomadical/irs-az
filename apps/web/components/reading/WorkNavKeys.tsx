'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const FOCUS_FLAG = 'irs-focus-title';

/**
 * ← / → move through the collection, but only while focus rests on the page
 * itself, so arrow keys inside controls keep their own meaning. After moving,
 * focus lands on the new title so screen readers announce the poem.
 */
export function WorkNavKeys({ prevHref, nextHref }: { prevHref: string | null; nextHref: string | null }) {
  const router = useRouter();

  useEffect(() => {
    try {
      if (sessionStorage.getItem(FOCUS_FLAG)) {
        sessionStorage.removeItem(FOCUS_FLAG);
        document.getElementById('work-title')?.focus();
      }
    } catch {}
  }, [prevHref, nextHref]);

  useEffect(() => {
    const flag = () => {
      try {
        sessionStorage.setItem(FOCUS_FLAG, '1');
      } catch {}
    };

    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const active = document.activeElement;
      const onPage = !active || active === document.body || active.matches('main, #work-title, #text');
      if (!onPage) return;
      const href = e.key === 'ArrowLeft' ? prevHref : e.key === 'ArrowRight' ? nextHref : null;
      if (!href) return;
      flag();
      router.push(href);
    }

    function onClick(e: MouseEvent) {
      if ((e.target as HTMLElement).closest('.work-nav a')) flag();
    }

    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [prevHref, nextHref, router]);

  return null;
}
