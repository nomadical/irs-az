'use client';

import { useState, useEffect } from 'react';

export interface ReadingPrefs {
  fontSize: number;   // 0–3
  width: number;      // 0–2
  fontFamily: ReadingFont;
}

export const readingFonts = ['book', 'literary', 'sans', 'system'] as const;
export type ReadingFont = (typeof readingFonts)[number];

const STORAGE_KEY = 'irs-reading-prefs';

const defaults: ReadingPrefs = {
  fontSize: 1,
  width: 0,
  fontFamily: 'book',
};

/** A saved choice, including the older 'serif' (now 'book') */
function fontOf(saved: unknown): ReadingFont {
  if (saved === 'serif') return 'book';
  return readingFonts.includes(saved as ReadingFont) ? (saved as ReadingFont) : defaults.fontFamily;
}

function load(): ReadingPrefs {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      fontSize: typeof parsed.fontSize === 'number' ? Math.min(3, Math.max(0, parsed.fontSize)) : defaults.fontSize,
      width: typeof parsed.width === 'number' ? Math.min(2, Math.max(0, parsed.width)) : defaults.width,
      fontFamily: fontOf(parsed.fontFamily),
    };
  } catch {
    return defaults;
  }
}

export function useReadingPrefs() {
  const [prefs, setPrefs] = useState<ReadingPrefs>(defaults);

  useEffect(() => {
    setPrefs(load());
  }, []);

  function update(patch: Partial<ReadingPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return { prefs, update };
}
