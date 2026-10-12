'use client';

import { useState, useEffect, useRef, useId } from 'react';
import { useTranslations } from 'next-intl';
import { readingFonts, type ReadingPrefs } from '@/lib/useReadingPrefs';

interface Props {
  prefs: ReadingPrefs;
  onUpdate: (patch: Partial<ReadingPrefs>) => void;
  isPoem: boolean;
}

const fontSizeSteps = ['S', 'M', 'L', 'XL'] as const;
const widthSteps = ['standard', 'wide', 'full'] as const;

export function AppearancePopover({ prefs, onUpdate, isPoem }: Props) {
  const t = useTranslations('reading');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

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
    // Tabbing out of the panel closes it, like any non-modal popup
    function onFocusIn(e: FocusEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  const step = (active: boolean, label: string, name: string, onClick: () => void) => (
    <button
      key={label}
      type="button"
      className={`appearance-step${active ? ' active' : ''}`}
      aria-pressed={active}
      aria-label={name}
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
        <div className="appearance-popover" id={panelId} ref={panelRef} role="dialog" aria-label={t('appearance')}>
          <div className="appearance-row" role="group" aria-label={t('appearance_size')}>
            <span className="appearance-label" aria-hidden="true">{t('appearance_size')}</span>
            <div className="appearance-steps">
              {fontSizeSteps.map((s, i) =>
                step(prefs.fontSize === i, s, t(`size_names.${s}`), () => onUpdate({ fontSize: i })),
              )}
            </div>
          </div>

          {/* Column width — poems keep their own measure */}
          {!isPoem && (
            <div className="appearance-row" role="group" aria-label={t('appearance_width')}>
              <span className="appearance-label" aria-hidden="true">{t('appearance_width')}</span>
              <div className="appearance-steps">
                {widthSteps.map((w, i) => {
                  const name = t(`width_names.${w}`);
                  return step(prefs.width === i, name, name, () => onUpdate({ width: i }));
                })}
              </div>
            </div>
          )}

          {/* Four faces don't fit beside the label: they sit under it, two by two */}
          <div className="appearance-row appearance-row--stacked" role="group" aria-label={t('appearance_font')}>
            <span className="appearance-label" aria-hidden="true">{t('appearance_font')}</span>
            <div className="appearance-steps appearance-steps--grid">
              {readingFonts.map((f) => {
                const name = t(`font_names.${f}`);
                return step(prefs.fontFamily === f, name, name, () => onUpdate({ fontFamily: f }));
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
