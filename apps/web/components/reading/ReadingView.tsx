'use client';

import { useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useReadingPrefs } from '@/lib/useReadingPrefs';
import { isArabicScript, langTag, lineCount, localeLang, sourceInfo, verseBlocks, type SourceInfo } from '@/lib/verse';
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
  sourceNote?: string | null;
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

const ORIGINAL = 'original';
const MAX_SEGMENTS = 4;
// Texts longer than this many lines open folded, culture.ru-style, showing the first part
const LONG_LINES = 40;
const FOLDED_LINES = 24;

const fontSizeValues = ['0.95rem', '1.05rem', '1.2rem', '1.35rem'];
const widthValues = ['36rem', '44rem', '100%'];

/** Keep the chosen version in the URL so it can be shared and survives reloads */
function syncUrl(patch: Record<string, string | null>) {
  const url = new URL(window.location.href);
  url.searchParams.delete('view');
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

  // The original is never hidden: choosing a translation sets it beside the original
  const translationLangs = [...new Set(translations.map((tr) => tr.language))].filter(
    (lang) => lang !== originalLang,
  );
  const choices = [ORIGINAL, ...translationLangs];

  const [selectedLang, setSelectedLang] = useState<string>(() => {
    const requested = params.get('lang');
    if (requested && choices.includes(requested)) return requested;
    const preferred = localeLang[locale];
    if (preferred && translationLangs.includes(preferred)) return preferred;
    const fallback = translations.find((tr) => tr.isDefault && tr.language !== originalLang)?.language;
    return fallback ?? translationLangs[0] ?? ORIGINAL;
  });

  // A language can have several translations (different translators); default first
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get('tr'));

  const { prefs, update: updatePrefs } = useReadingPrefs();

  // Folding of long texts: open once expanded, across language switches
  const [expanded, setExpanded] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const textId = 'work-text';

  const versions = selectedLang === ORIGINAL ? [] : translations.filter((tr) => tr.language === selectedLang);
  const translation =
    versions.find((tr) => tr.id === selectedId) ??
    versions.find((tr) => tr.isDefault) ??
    versions[0] ??
    null;
  // Where the translation itself comes from, e.g. the scanned book on Internet Archive
  const translationSource = sourceInfo(translation?.sourceNote);

  /** Translator's name, or the translation type when there is none; numbered if still ambiguous */
  const versionLabel = (tr: Translation, i: number) => {
    const base = tr.translator ?? tc(`ttype.${tr.type}` as any);
    const ambiguous = versions.some(
      (other) => other !== tr && (other.translator ?? tc(`ttype.${other.type}` as any)) === base,
    );
    return `${base}${tr.year ? `, ${tr.year}` : ''}${ambiguous ? ` (${i + 1})` : ''}`;
  };

  const isPoem = genre === 'POEM';
  const originalDir = scriptDirection === 'RTL' ? 'rtl' : 'ltr';
  // Some imports are tagged Arabic-script but hold a Latin transliteration;
  // tag by the script actually present so fonts and screen readers match
  const originalTag =
    ['AZ_ARABIC', 'FA', 'AR'].includes(originalLang) && !isArabicScript(body)
      ? `${langTag[originalLang].split('-')[0]}-Latn`
      : langTag[originalLang];
  const langName = (lang: string) => (lang === ORIGINAL ? t('original_option') : tc(`lang.${lang}` as any));

  const readingVars = {
    '--reading-size': fontSizeValues[prefs.fontSize],
    '--reading-width': isPoem ? undefined : widthValues[prefs.width],
    '--reading-font': prefs.fontFamily === 'sans' ? 'var(--font-ui)' : 'var(--font-body)',
    '--reading-leading': prefs.fontSize >= 2 ? 2.1 : 1.95,
  } as CSSProperties;

  const columnClass = `reading-column${isPoem ? ' is-poem' : ''}`;

  function chooseLang(next: string) {
    setSelectedLang(next);
    setSelectedId(null);
    syncUrl({ lang: next === ORIGINAL ? null : next, tr: null });
  }

  function chooseVersion(id: string) {
    setSelectedId(id);
    syncUrl({ tr: id });
  }

  const originalAttrs = { lang: originalTag, dir: originalDir } as const;
  const translationHtml = translation ? translation.bodyHtml || translation.body : '';
  const translationAttrs = translation
    ? ({ lang: langTag[translation.language], dir: translation.scriptDirection === 'RTL' ? 'rtl' : 'ltr' } as const)
    : null;

  // Long texts open folded; decided from the text itself so server and client agree
  const lines = Math.max(lineCount(body), translation ? lineCount(translationHtml) : 0);
  const foldable = lines > LONG_LINES;
  const folded = foldable && !expanded;
  const foldClass = folded ? ' is-folded' : '';
  const foldVars = { '--folded-lines': FOLDED_LINES } as CSSProperties;

  function unfold() {
    setExpanded(true);
    // The button goes away; keep focus in the text instead of dropping it on <body>
    requestAnimationFrame(() => textRef.current?.focus({ preventScroll: true }));
  }

  // Line the two texts up beyt by beyt when both split into the same blocks;
  // on a phone this interleaves them instead of stacking two whole poems
  const originalBlocks = translation ? verseBlocks(body) : null;
  const translationBlocks = translation ? verseBlocks(translationHtml) : null;
  const rows =
    originalBlocks && translationBlocks && originalBlocks.length === translationBlocks.length
      ? originalBlocks.map((block, i) => [block, translationBlocks[i]] as const)
      : null;

  const control =
    choices.length > 1 &&
    (choices.length <= MAX_SEGMENTS ? (
      <div className="lang-tabs" role="group" aria-label={t('read_as')}>
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => chooseLang(choice)}
            className={`lang-tab${selectedLang === choice ? ' active' : ''}`}
            aria-pressed={selectedLang === choice}
          >
            {langName(choice)}
          </button>
        ))}
      </div>
    ) : (
      <label className="reading-select">
        <span>{t('read_as')}</span>
        <select value={selectedLang} onChange={(e) => chooseLang(e.target.value)}>
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {langName(choice)}
            </option>
          ))}
        </select>
      </label>
    ));

  return (
    <div className="reading" id="text" tabIndex={-1}>
      <div
        className={`reading-toolbar${
          translation
            ? ' reading-toolbar--wide'
            : !control
              ? ' reading-toolbar--solo'
              : isPoem && originalDir === 'rtl'
                ? ' reading-toolbar--verse'
                : ''
        }`}
      >
        {control || <span />}
        <AppearancePopover prefs={prefs} onUpdate={updatePrefs} isPoem={isPoem} />
      </div>

      {versions.length > 1 && translation && (
        <div className="lang-tabs lang-tabs--versions" role="group" aria-label={t('version_label')}>
          {versions.map((tr, i) => (
            <button
              key={tr.id}
              type="button"
              onClick={() => chooseVersion(tr.id)}
              className={`lang-tab${translation.id === tr.id ? ' active' : ''}`}
              aria-pressed={translation.id === tr.id}
            >
              {versionLabel(tr, i)}
            </button>
          ))}
        </div>
      )}

      {translation && translationAttrs ? (
        <div
          className={`parallel${foldClass}`}
          style={{ ...readingVars, ...foldVars }}
          id={textId}
          ref={textRef}
          tabIndex={foldable ? -1 : undefined}
        >
          <div className="parallel-row parallel-head" aria-hidden="true">
            <p className="lang-label">
              {langName(originalLang)} · {t('original_suffix')}
            </p>
            <p className="lang-label">{langName(translation.language)}</p>
          </div>
          {rows ? (
            rows.map(([orig, trans], i) => (
              <div className="parallel-row" key={i}>
                <div className={`${columnClass} parallel-cell`} {...originalAttrs} dangerouslySetInnerHTML={{ __html: orig }} />
                <div className={`${columnClass} parallel-cell`} {...translationAttrs} dangerouslySetInnerHTML={{ __html: trans }} />
              </div>
            ))
          ) : (
            <div className="parallel-row parallel-row--whole">
              <div className={`${columnClass} parallel-cell`} {...originalAttrs} dangerouslySetInnerHTML={{ __html: body }} />
              <div className={`${columnClass} parallel-cell`} {...translationAttrs} dangerouslySetInnerHTML={{ __html: translationHtml }} />
            </div>
          )}
        </div>
      ) : (
        <div
          className={`${columnClass}${foldClass}`}
          style={{ ...readingVars, ...foldVars }}
          id={textId}
          ref={textRef}
          tabIndex={foldable ? -1 : undefined}
          {...originalAttrs}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}

      {folded && (
        <div className="unfold">
          <button type="button" className="unfold-btn" onClick={unfold} aria-expanded={false} aria-controls={textId}>
            {t('read_on')}
          </button>
        </div>
      )}

      <div className="tailpiece" aria-hidden="true">◆</div>

      <footer className="provenance">
        <p>
          <span className="provenance-key">{translation ? t('original_text') : t('source')}</span>
          {source ? (
            <>
              {source.href ? (
                <a href={source.href} target="_blank" rel="noopener noreferrer">
                  {source.label}
                  <span aria-hidden="true"> ↗</span>
                  <span className="sr-only"> {t('new_tab')}</span>
                </a>
              ) : (
                <span>{source.label}</span>
              )}
              {source.license && <span className="provenance-meta">{source.license}</span>}
            </>
          ) : (
            <span className="provenance-missing">{t('source_missing')}</span>
          )}
        </p>
        {translation?.translator && (
          <p>
            <span className="provenance-key">{t('translator')}</span>
            <span>
              {translation.translator}
              {translation.year && `, ${translation.year}`}
            </span>
            {translationSource?.href && (
              <span className="provenance-meta">
                <a href={translationSource.href} target="_blank" rel="noopener noreferrer">
                  {translationSource.label}
                  <span aria-hidden="true"> ↗</span>
                  <span className="sr-only"> {t('new_tab')}</span>
                </a>
              </span>
            )}
          </p>
        )}
        {translation?.translatorNote && (
          <p>
            <span className="provenance-key">{t('translator_note')}</span>
            <span dir="auto">{translation.translatorNote}</span>
          </p>
        )}
        <p className="provenance-cta">
          {translations.length === 0 && <span>{t('no_translation')} </span>}
          <Link href={suggestHref}>
            {translations.length > 0 ? `+ ${t('no_translation_cta')}` : `${t('no_translation_cta')} →`}
          </Link>
        </p>
      </footer>
    </div>
  );
}
