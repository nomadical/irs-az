'use client';

import { useState } from 'react';
import { useReadingPrefs } from '@/lib/useReadingPrefs';
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
}

type ViewMode = 'default' | 'parallel' | 'original';

const langLabels: Record<string, string> = {
  AZ_LATIN: 'Azərbaycanca',
  RU: 'Rusca',
  FA: 'Farsca',
  EN: 'English',
  AR: 'Ərəbcə',
  AZ_ARABIC: 'Azərbaycanca (ərəb)',
  AZ_CYRILLIC: 'Azərbaycanca (kiril)',
  TR: 'Türkcə',
};

const langLabelsRu: Record<string, string> = {
  AZ_LATIN: 'Азербайджанский',
  RU: 'Русский',
  FA: 'Персидский',
  EN: 'Английский',
  AR: 'Арабский',
};

const langLabelsEn: Record<string, string> = {
  AZ_LATIN: 'Azerbaijani',
  RU: 'Russian',
  FA: 'Persian',
  EN: 'English',
  AR: 'Arabic',
  AZ_ARABIC: 'Azerbaijani (Arabic)',
  AZ_CYRILLIC: 'Azerbaijani (Cyrillic)',
  TR: 'Turkish',
};

const fontSizeValues = ['0.95rem', '1.05rem', '1.2rem', '1.35rem'];
const widthValues = ['36rem', '44rem', '100%'];

export function ReadingView({
  body,
  translations,
  originalLang,
  scriptDirection,
  locale,
  genre,
}: Props) {
  const [mode, setMode] = useState<ViewMode>('default');
  const [selectedLang, setSelectedLang] = useState<string>(() => {
    const hasAzLatin = translations.some((t) => t.language === 'AZ_LATIN');
    if (hasAzLatin) return 'AZ_LATIN';
    if (originalLang === 'AZ_LATIN') return 'AZ_LATIN';
    const defaultTrans = translations.find((t) => t.isDefault);
    return defaultTrans?.language ?? translations[0]?.language ?? 'AZ_LATIN';
  });

  const { prefs, update: updatePrefs } = useReadingPrefs();

  const translationLangs = [...new Set(translations.map((t) => t.language))];
  // When original is AZ_LATIN, include it so users can switch back after viewing a translation
  const availableLangs =
    originalLang === 'AZ_LATIN' && !translationLangs.includes('AZ_LATIN')
      ? ['AZ_LATIN', ...translationLangs]
      : translationLangs;

  // For AZ_LATIN when original is AZ, there's no translation record — use the body prop
  const selectedTranslation =
    selectedLang === 'AZ_LATIN' && originalLang === 'AZ_LATIN'
      ? null
      : translations.find((t) => t.language === selectedLang && t.isDefault) ??
        translations.find((t) => t.language === selectedLang);

  const isOriginalRtl = scriptDirection === 'RTL';
  const labels = locale === 'ru' ? langLabelsRu : locale === 'en' ? langLabelsEn : langLabels;

  const isPoem = genre === 'POEM';
  const shouldCenterPoem = isPoem && translations.length === 0;

  // Computed reading styles
  const readingStyle = {
    fontSize: fontSizeValues[prefs.fontSize],
    maxWidth: isPoem ? '36rem' : widthValues[prefs.width],
    fontFamily: prefs.fontFamily === 'sans' ? 'var(--font-ui)' : 'var(--font-body)',
    lineHeight: prefs.fontSize >= 2 ? 2.1 : 1.95,
  };

  // For parallel columns, omit maxWidth
  const parallelReadingStyle = {
    fontSize: readingStyle.fontSize,
    fontFamily: readingStyle.fontFamily,
    lineHeight: readingStyle.lineHeight,
    maxWidth: 'none',
  };

  const columnClass = `reading-column${shouldCenterPoem && mode !== 'parallel' ? ' poem-centered' : ''}`;

  // Tabs
  const tabs: { mode: ViewMode; label: string }[] = [];

  if (translations.length > 0) {
    tabs.push({
      mode: 'default',
      label: locale === 'ru' ? 'Перевод' : locale === 'en' ? 'Translation' : 'Tərcümə',
    });
    tabs.push({
      mode: 'parallel',
      label: locale === 'ru' ? 'Параллельный' : locale === 'en' ? 'Parallel' : 'Paralel',
    });
  }

  if (originalLang !== 'AZ_LATIN') {
    tabs.push({
      mode: 'original',
      label: locale === 'ru' ? 'Оригинал' : locale === 'en' ? 'Original' : 'Əsl mətn',
    });
  }

  return (
    <div>
      {/* Appearance control + Mode tabs + language selector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem', position: 'relative' }}>
        <AppearancePopover
          prefs={prefs}
          onUpdate={updatePrefs}
          isPoem={isPoem}
          locale={locale}
        />

        {(tabs.length > 0 || availableLangs.length > 1) && (
          <>
            <div className="lang-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.mode}
                  onClick={() => setMode(tab.mode)}
                  className={`lang-tab ${mode === tab.mode ? 'active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {mode !== 'original' && availableLangs.length > 1 && (
              <div className="lang-tabs">
                {availableLangs.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLang(lang)}
                    className={`lang-tab ${selectedLang === lang ? 'active' : ''}`}
                  >
                    {labels[lang] ?? lang}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Content: Default (translation or original) */}
      {mode === 'default' && selectedTranslation && (
        <div className={columnClass} style={readingStyle}>
          <div
            dangerouslySetInnerHTML={{
              __html: selectedTranslation.bodyHtml || selectedTranslation.body,
            }}
          />
          {selectedTranslation.translator && (
            <p
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.7rem',
                color: 'var(--muted)',
                marginTop: '2.5rem',
                textAlign: 'right',
                fontStyle: 'italic',
              }}
            >
              {locale === 'ru' ? 'Перевод' : locale === 'en' ? 'Translation' : 'Tərcümə'}:{' '}
              {selectedTranslation.translator}
              {selectedTranslation.year && `, ${selectedTranslation.year}`}
            </p>
          )}
        </div>
      )}

      {mode === 'default' && !selectedTranslation && originalLang !== 'AZ_LATIN' && (
        <div className={columnClass} style={readingStyle}>
          <p style={{ color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
            {locale === 'ru'
              ? 'Перевод на азербайджанский язык пока недоступен.'
              : locale === 'en'
                ? 'Azerbaijani translation is not yet available.'
                : 'Azərbaycanca tərcümə hələ əlavə olunmayıb.'}
          </p>
        </div>
      )}

      {mode === 'default' && !selectedTranslation && originalLang === 'AZ_LATIN' && (
        <div
          className={columnClass}
          style={readingStyle}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}

      {/* Content: Parallel */}
      {mode === 'parallel' && selectedTranslation && (
        <div className="parallel-grid">
          <div className="parallel-col">
            <p className="lang-label">
              {labels[selectedLang] ?? selectedLang}
              {selectedTranslation.translator && (
                <span style={{ fontWeight: 400, marginLeft: '0.5rem' }}>
                  — {selectedTranslation.translator}
                </span>
              )}
            </p>
            <div
              className="reading-column"
              style={parallelReadingStyle}
              dangerouslySetInnerHTML={{
                __html: selectedTranslation.bodyHtml || selectedTranslation.body,
              }}
            />
          </div>
          <div className="parallel-col">
            <p className="lang-label">
              {labels[originalLang] ?? originalLang}
              <span style={{ fontWeight: 400, marginLeft: '0.5rem' }}>
                — {locale === 'ru' ? 'оригинал' : locale === 'en' ? 'original' : 'əsli'}
              </span>
            </p>
            <div
              className="reading-column"
              style={parallelReadingStyle}
              dir={isOriginalRtl ? 'rtl' : 'ltr'}
              dangerouslySetInnerHTML={{ __html: body }}
            />
          </div>
        </div>
      )}

      {/* Content: Original only */}
      {mode === 'original' && (
        <div
          className={columnClass}
          style={readingStyle}
          dir={isOriginalRtl ? 'rtl' : 'ltr'}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}
    </div>
  );
}
