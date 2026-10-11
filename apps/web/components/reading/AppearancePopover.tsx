'use client';

import { useState, useEffect, useRef } from 'react';
import type { ReadingPrefs } from '@/lib/useReadingPrefs';

interface Props {
  prefs: ReadingPrefs;
  onUpdate: (patch: Partial<ReadingPrefs>) => void;
  isPoem: boolean;
  locale: string;
}

const labels: Record<string, { fontSizeLabel: string; widthLabel: string; fontLabel: string; serif: string; sans: string; standard: string; wide: string; full: string }> = {
  az: { fontSizeLabel: 'Ölçü', widthLabel: 'En', fontLabel: 'Şrift', serif: 'Serif', sans: 'Sans', standard: 'Standart', wide: 'Geniş', full: 'Tam' },
  ru: { fontSizeLabel: 'Размер', widthLabel: 'Ширина', fontLabel: 'Шрифт', serif: 'Serif', sans: 'Sans', standard: 'Стандарт', wide: 'Широкий', full: 'Полный' },
  en: { fontSizeLabel: 'Size', widthLabel: 'Width', fontLabel: 'Font', serif: 'Serif', sans: 'Sans', standard: 'Standard', wide: 'Wide', full: 'Full' },
};

const fontSizeSteps = ['S', 'M', 'L', 'XL'];
const widthSteps = (l: typeof labels['az']) => [l.standard, l.wide, l.full];

export function AppearancePopover({ prefs, onUpdate, isPoem, locale }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const l = labels[locale] ?? labels.az;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div className="appearance-anchor" ref={ref}>
      <button
        className="appearance-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Appearance"
        title="Appearance"
      >
        Aa
      </button>

      {open && (
        <div className="appearance-popover">
          {/* Font size */}
          <div className="appearance-row">
            <span className="appearance-label">{l.fontSizeLabel}</span>
            <div className="appearance-steps">
              {fontSizeSteps.map((step, i) => (
                <button
                  key={step}
                  className={`appearance-step${prefs.fontSize === i ? ' active' : ''}`}
                  onClick={() => onUpdate({ fontSize: i })}
                >
                  {step}
                </button>
              ))}
            </div>
          </div>

          {/* Column width — hidden for poems */}
          {!isPoem && (
            <div className="appearance-row">
              <span className="appearance-label">{l.widthLabel}</span>
              <div className="appearance-steps">
                {widthSteps(l).map((step, i) => (
                  <button
                    key={step}
                    className={`appearance-step${prefs.width === i ? ' active' : ''}`}
                    onClick={() => onUpdate({ width: i })}
                  >
                    {step}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Font family */}
          <div className="appearance-row">
            <span className="appearance-label">{l.fontLabel}</span>
            <div className="appearance-steps">
              {(['serif', 'sans'] as const).map((f) => (
                <button
                  key={f}
                  className={`appearance-step${prefs.fontFamily === f ? ' active' : ''}`}
                  onClick={() => onUpdate({ fontFamily: f })}
                >
                  {l[f]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
