'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useReadingPrefs } from '@/lib/useReadingPrefs';
import { isArabicScript, langTag, localeLang, type SourceInfo } from '@/lib/verse';
import { AppearancePopover } from './AppearancePopover';

interface Translation {
  id: string;
  language: string;
  type: string;
  body: string;
  bodyHtml: string | null;
  translator: string | null;
  translatorNote: string | null;
  year: number | null;
  isDefault: boolean;
  scriptDirection: string;
}

interface Props {
  body: string;
  translations: Translation[];
  originalLang: string;
  scriptDirection: string;
  locale: string;
  genre: string;
  source: SourceInfo | null;
  suggestHref: string;
}

type ViewMode = 'translation' | 'parallel' | 'original';
const MODES: ViewMode[] = ['translation', 'parallel', 'original'];

const fontSizeValues = ['0.95rem', '1.05rem', '1.2rem', '1.35rem'];
const widthValues = ['36rem', '44rem', '100%'];

/** Keep the chosen view in the URL so it can be shared and survives reloads */
function syncUrl(patch: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(patch)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(window.history.state, '', url);
}

export function ReadingView({
  body,
  translations,
  originalLang,
  scriptDirection,
  locale,
  genre,
  source,
  suggestHref,
}: Props) {
  const t = useTranslations('reading');
  const tc = useTranslations('contribute.options');
  const params = useSearchParams();

  // An AZ Latin original is itself readable to the default audience, so it
  // sits in the language list instead of behind an "Original" tab
  const translationLangs = [...new Set(translations.map((tr) => tr.language))];
  const availableLangs =
    originalLang === 'AZ_LATIN' && translationLangs.length > 0 && !translationLangs.includes('AZ_LATIN')
      ? ['AZ_LATIN', ...translationLangs]
      : translationLangs;
  const hasTranslations = translations.length > 0;

  const [mode, setMode] = useState<ViewMode>(() => {
    const requested = params.get('view') as ViewMode | null;
    if (hasTranslations && requested && MODES.includes(requested)) return requested;
    return hasTranslations ? 'translation' : 'original';
  });

  const [selectedLang, setSelectedLang] = useState<string>(() => {
    const requested = params.get('lang');
    if (requested && availableLangs.includes(requested)) return requested;
    const preferred = localeLang[locale];
    if (preferred && availableLangs.includes(preferred)) return preferred;
    return translations.find((tr) => tr.isDefault)?.language ?? availableLangs[0] ?? originalLang;
  });

  const { prefs, update: updatePrefs } = useReadingPrefs();

  const selectedTranslation =
    selectedLang === originalLang
      ? null
      : translations.find((tr) => tr.language === selectedLang && tr.isDefault) ??
        translations.find((tr) => tr.language === selectedLang) ??
        null;

  const isPoem = genre === 'POEM';
  const originalDir = scriptDirection === 'RTL' ? 'rtl' : 'ltr';
  // Some imports are tagged Arabic-script but hold a Latin transliteration;
  // tag by the script actually present so fonts and screen readers match
  const originalTag =
    ['AZ_ARABIC', 'FA', 'AR'].includes(originalLang) && !isArabicScript(body)
      ? `${langTag[originalLang].split('-')[0]}-Latn`
      : langTag[originalLang];
  const langName = (lang: string) => tc(`lang.${lang}` as any);

  const readingVars = {
    '--reading-size': fontSizeValues[prefs.fontSize],
    '--reading-width': isPoem ? undefined : widthValues[prefs.width],
    '--reading-font': prefs.fontFamily === 'sans' ? 'var(--font-ui)' : 'var(--font-body)',
    '--reading-leading': prefs.fontSize >= 2 ? 2.1 : 1.95,
  } as CSSProperties;

  const columnClass = `reading-column${isPoem ? ' is-poem' : ''}`;

  function chooseMode(next: ViewMode) {
    setMode(next);
    syncUrl({ view: next === 'translation' ? null : next });
  }

  function chooseLang(next: string) {
    setSelectedLang(next);
    syncUrl({ lang: next });
  }

  const originalColumn = (
    <div
      className={columnClass}
      style={readingVars}
      lang={originalTag}
      dir={originalDir}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );

  const translationColumn = selectedTranslation ? (
    <div
      className={columnClass}
      style={readingVars}
      lang={langTag[selectedTranslation.language]}
      dir={selectedTranslation.scriptDirection === 'RTL' ? 'rtl' : 'ltr'}
      dangerouslySetInnerHTML={{ __html: selectedTranslation.bodyHtml || selectedTranslation.body }}
    />
  ) : (
    originalColumn
  );

  const showsTranslation = mode !== 'original' && selectedTranslation;

  return (
    <div className="reading" id="text">
      <div
        className={`reading-toolbar${
          mode === 'parallel' ? ' reading-toolbar--wide' : isPoem && mode === 'original' && originalDir === 'rtl' ? ' reading-toolbar--verse' : ''
        }`}
      >
        {hasTranslations ? (
          <div className="lang-tabs" role="group" aria-label={t('mode_label')}>
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => chooseMode(m)}
                className={`lang-tab${mode === m ? ' active' : ''}`}
                aria-pressed={mode === m}
              >
                {t(`mode_${m}`)}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <AppearancePopover prefs={prefs} onUpdate={updatePrefs} isPoem={isPoem} />
      </div>

      {mode !== 'original' && availableLangs.length > 1 && (
        <div className="lang-tabs lang-tabs--langs" role="group" aria-label={t('lang_label')}>
          {availableLangs.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => chooseLang(lang)}
              className={`lang-tab${selectedLang === lang ? ' active' : ''}`}
              aria-pressed={selectedLang === lang}
            >
              {langName(lang)}
            </button>
          ))}
        </div>
      )}

      {mode === 'parallel' && selectedTranslation ? (
        <div className="parallel-grid">
          <div className="parallel-col">
            <p className="lang-label">{langName(selectedTranslation.language)}</p>
            {translationColumn}
          </div>
          <div className="parallel-col">
            <p className="lang-label">
              {langName(originalLang)} · {t('original_suffix')}
            </p>
            {originalColumn}
          </div>
        </div>
      ) : mode === 'original' ? (
        originalColumn
      ) : (
        translationColumn
      )}

      <div className="tailpiece" aria-hidden="true">◆</div>

      <footer className="provenance">
        {source && (
          <p>
            <span className="provenance-key">{showsTranslation ? t('original_text') : t('source')}</span>
            {source.href ? (
              <a href={source.href} target="_blank" rel="noopener noreferrer">
                {source.label}
              </a>
            ) : (
              <span>{source.label}</span>
            )}
            {source.license && <span className="provenance-meta">{source.license}</span>}
          </p>
        )}
        {showsTranslation && selectedTranslation.translator && (
          <p>
            <span className="provenance-key">{t('translator')}</span>
            <span>
              {selectedTranslation.translator}
              {selectedTranslation.year && `, ${selectedTranslation.year}`}
            </span>
          </p>
        )}
        <p className="provenance-cta">
          {!hasTranslations && <span>{t('no_translation')} </span>}
          <Link href={suggestHref}>{hasTranslations ? `+ ${t('no_translation_cta')}` : `${t('no_translation_cta')} →`}</Link>
        </p>
      </footer>
    </div>
  );
}
