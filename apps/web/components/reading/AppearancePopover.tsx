'use client';

import { useState, useEffect, useRef, useId } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReadingPrefs } from '@/lib/useReadingPrefs';

interface Props {
  prefs: ReadingPrefs;
  onUpdate: (patch: Partial<ReadingPrefs>) => void;
  isPoem: boolean;
}

const labels: Record<string, { fontSizeLabel: string; widthLabel: string; fontLabel: string; serif: string; sans: string; standard: string; wide: string; full: string }> = {
  az: { fontSizeLabel: 'Ölçü', widthLabel: 'En', fontLabel: 'Şrift', serif: 'Serif', sans: 'Sans', standard: 'Standart', wide: 'Geniş', full: 'Tam' },
  ru: { fontSizeLabel: 'Размер', widthLabel: 'Ширина', fontLabel: 'Шрифт', serif: 'Serif', sans: 'Sans', standard: 'Стандарт', wide: 'Широкий', full: 'Полный' },
  en: { fontSizeLabel: 'Size', widthLabel: 'Width', fontLabel: 'Font', serif: 'Serif', sans: 'Sans', standard: 'Standard', wide: 'Wide', full: 'Full' },
};

const fontSizeSteps = ['S', 'M', 'L', 'XL'];
const widthSteps = (l: typeof labels['az']) => [l.standard, l.wide, l.full];

export function AppearancePopover({ prefs, onUpdate, isPoem }: Props) {
  const t = useTranslations('reading');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const locale = useLocale();
  const l = labels[locale] ?? labels.az;

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLButtonElement>('button.active') ?? panel?.querySelector('button'))?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
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

  const step = (active: boolean, label: string, onClick: () => void) => (
    <button
      key={label}
      type="button"
      className={`appearance-step${active ? ' active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <div className="appearance-anchor" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className="appearance-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('appearance')}
        aria-expanded={open}
        aria-controls={panelId}
        title={t('appearance')}
      >
        Aa
      </button>

      {open && (
        <div className="appearance-popover" id={panelId} ref={panelRef} role="group" aria-label={t('appearance')}>
          <div className="appearance-row">
            <span className="appearance-label">{l.fontSizeLabel}</span>
            <div className="appearance-steps">
              {fontSizeSteps.map((s, i) => step(prefs.fontSize === i, s, () => onUpdate({ fontSize: i })))}
            </div>
          </div>

          {/* Column width — poems keep their own measure */}
          {!isPoem && (
            <div className="appearance-row">
              <span className="appearance-label">{l.widthLabel}</span>
              <div className="appearance-steps">
                {widthSteps(l).map((s, i) => step(prefs.width === i, s, () => onUpdate({ width: i })))}
              </div>
            </div>
          )}

          <div className="appearance-row">
            <span className="appearance-label">{l.fontLabel}</span>
            <div className="appearance-steps">
              {(['serif', 'sans'] as const).map((f) =>
                step(prefs.fontFamily === f, l[f], () => onUpdate({ fontFamily: f })),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
