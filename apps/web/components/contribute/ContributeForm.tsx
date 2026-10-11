'use client';

import { ComponentProps, ReactNode, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError, PublicSubmission } from '@/lib/api';

type Kind = PublicSubmission['type'];

export interface AuthorOption {
  id: string;
  slug: string;
  name: string;
}

export interface WorkOption {
  id: string;
  title: string;
  authorName: string;
}

const ORIGINAL_LANGS = ['AZ_LATIN', 'AZ_ARABIC', 'FA', 'AR', 'TR', 'RU'];
const TRANSLATION_LANGS = ['AZ_LATIN', 'RU', 'EN', 'TR', 'FA'];
const GENRES = ['POEM', 'PROSE', 'PLAY', 'ESSAY', 'PHILOSOPHY', 'LETTER', 'MEMOIR'];
const FORMS = ['GHAZAL', 'MASNAVI', 'RUBAI', 'QASIDA', 'MURABBA', 'FREE_VERSE', 'OTHER'];
const TRANSLATION_TYPES = ['TRANSLATION', 'TRANSLITERATION', 'MODERNIZATION'];
const AUTHOR_TYPES = ['POET', 'WRITER', 'PLAYWRIGHT', 'PHILOSOPHER', 'CRITIC'];
const MAX_YEAR = new Date().getFullYear();

function Field({ label, optional, hint, children }: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  const t = useTranslations('contribute');
  return (
    <label className="form-field">
      <span className="form-label">
        {label}
        {optional && <em> · {t('optional')}</em>}
      </span>
      {children}
      {hint && <span className="form-hint">{hint}</span>}
    </label>
  );
}

function Options({ values, group }: { values: string[]; group: string }) {
  const t = useTranslations('contribute.options');
  return values.map((v) => <option key={v} value={v}>{t(`${group}.${v}`)}</option>);
}

function YearInput({ name }: { name: string }) {
  return <input className="form-input" type="number" name={name} min={-3000} max={MAX_YEAR} step={1} />;
}

/** Author dropdown + title search, for choosing the work a translation belongs to. */
function WorkPicker({ authors, value, onChange }: {
  authors: AuthorOption[];
  value: WorkOption | null;
  onChange: (work: WorkOption | null) => void;
}) {
  const t = useTranslations('contribute');
  const [authorSlug, setAuthorSlug] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorkOption[] | null>(null);

  useEffect(() => {
    if (!authorSlug && query.trim().length < 2) {
      setResults(null);
      return;
    }
    const params = new URLSearchParams({ limit: '20' });
    if (authorSlug) params.set('authorSlug', authorSlug);
    if (query.trim()) params.set('q', query.trim());

    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = (await api.getWorks(params).catch(() => null)) as { data: any[] } | null;
      if (cancelled) return;
      setResults(
        (res?.data ?? []).map((w) => ({ id: w.id, title: w.titleAz, authorName: w.author.nameAz })),
      );
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authorSlug, query]);

  if (value) {
    return (
      <div className="work-picker-chosen">
        <span>
          <strong>{value.title}</strong> · {value.authorName}
        </span>
        <button type="button" className="form-link" onClick={() => onChange(null)}>
          {t('work_change')}
        </button>
      </div>
    );
  }

  return (
    <div className="work-picker">
      <div className="form-row">
        <select className="form-input" value={authorSlug} onChange={(e) => setAuthorSlug(e.target.value)} aria-label={t('author')}>
          <option value="">{t('author_choose')}</option>
          {authors.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </select>
        <input
          className="form-input"
          type="search"
          placeholder={t('work_search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('work_search')}
        />
      </div>
      {results && (
        <ul className="work-picker-results">
          {results.length === 0 && <li className="form-hint">{t('work_none')}</li>}
          {results.map((w) => (
            <li key={w.id}>
              <button type="button" onClick={() => onChange(w)}>
                {w.title} <span>· {w.authorName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ContributeForm({ authors, initialKind = 'WORK', initialWork = null }: {
  authors: AuthorOption[];
  initialKind?: Kind;
  initialWork?: WorkOption | null;
}) {
  const t = useTranslations('contribute');
  const [kind, setKind] = useState<Kind>(initialKind);
  const [genre, setGenre] = useState('POEM');
  const [work, setWork] = useState<WorkOption | null>(initialWork);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit: ComponentProps<'form'>['onSubmit'] = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const str = (k: string) => String(form.get(k) ?? '').trim() || undefined;
    const int = (k: string) => (str(k) ? Number(str(k)) : undefined);

    if (kind === 'TRANSLATION' && !work) {
      setError(t('work_required'));
      return;
    }

    const payload = {
      WORK: {
        authorId: str('authorId'),
        titleAz: str('titleAz'),
        titleRu: str('titleRu'),
        originalLang: str('originalLang'),
        genre: str('genre'),
        form: genre === 'POEM' ? str('form') : undefined,
        year: int('year'),
        body: str('body'),
      },
      TRANSLATION: {
        workId: work?.id,
        language: str('language'),
        type: str('translationType'),
        translator: str('translator'),
        year: int('year'),
        translatorNote: str('translatorNote'),
        body: str('body'),
      },
      AUTHOR: {
        nameAz: str('nameAz'),
        nameRu: str('nameRu'),
        nameEn: str('nameEn'),
        type: str('authorType'),
        bornYear: int('bornYear'),
        diedYear: int('diedYear'),
        bioAz: str('bio'),
      },
    }[kind];

    setSending(true);
    setError(null);
    try {
      await api.submitPublic({
        type: kind,
        payload,
        contactName: str('contactName') ?? '',
        contactEmail: str('contactEmail') ?? '',
        sourceNote: str('sourceNote'),
        website: str('website'),
      });
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t('error_rate') : t('error_generic'));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="form-success" role="status">
        <h2>{t('success_title')}</h2>
        <p>{t('success_body')}</p>
        <button type="button" className="btn" onClick={() => { setSent(false); setWork(null); }}>
          {t('success_again')}
        </button>
      </div>
    );
  }

  const tabs: [Kind, string][] = [
    ['WORK', t('tab_work')],
    ['TRANSLATION', t('tab_translation')],
    ['AUTHOR', t('tab_author')],
  ];

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="lang-tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            className="lang-tab"
            aria-selected={kind === k}
            onClick={() => { setKind(k); setError(null); }}
          >
            {label}
          </button>
        ))}
      </div>

      <fieldset className="form-section">
        <legend className="section-label">{t('section_text')}</legend>

        {kind === 'WORK' && (
          <>
            <Field label={t('author')}>
              <select className="form-input" name="authorId" required defaultValue="">
                <option value="" disabled>{t('author_choose')}</option>
                {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <p className="form-hint">
              {t('author_missing')}{' '}
              <button type="button" className="form-link" onClick={() => setKind('AUTHOR')}>
                {t('author_suggest')}
              </button>
            </p>
            <div className="form-row">
              <Field label={t('title_az')}>
                <input className="form-input" name="titleAz" required maxLength={200} />
              </Field>
              <Field label={t('title_ru')} optional>
                <input className="form-input" name="titleRu" maxLength={200} />
              </Field>
            </div>
            <div className="form-row">
              <Field label={t('original_lang')}>
                <select className="form-input" name="originalLang" defaultValue="AZ_LATIN">
                  <Options values={ORIGINAL_LANGS} group="lang" />
                </select>
              </Field>
              <Field label={t('genre')}>
                <select className="form-input" name="genre" value={genre} onChange={(e) => setGenre(e.target.value)}>
                  <Options values={GENRES} group="genre" />
                </select>
              </Field>
              {genre === 'POEM' && (
                <Field label={t('form')} optional>
                  <select className="form-input" name="form" defaultValue="">
                    <option value="" />
                    <Options values={FORMS} group="form" />
                  </select>
                </Field>
              )}
              <Field label={t('year')} optional>
                <YearInput name="year" />
              </Field>
            </div>
          </>
        )}

        {kind === 'TRANSLATION' && (
          <>
            <div className="form-field">
              <span className="form-label">{t('work')}</span>
              <WorkPicker authors={authors} value={work} onChange={setWork} />
            </div>
            <div className="form-row">
              <Field label={t('language')}>
                <select className="form-input" name="language" defaultValue="RU">
                  <Options values={TRANSLATION_LANGS} group="lang" />
                </select>
              </Field>
              <Field label={t('translation_type')}>
                <select className="form-input" name="translationType" defaultValue="TRANSLATION">
                  <Options values={TRANSLATION_TYPES} group="ttype" />
                </select>
              </Field>
            </div>
            <div className="form-row">
              <Field label={t('translator')} optional>
                <input className="form-input" name="translator" maxLength={200} />
              </Field>
              <Field label={t('year')} optional>
                <YearInput name="year" />
              </Field>
            </div>
          </>
        )}

        {kind === 'AUTHOR' && (
          <>
            <div className="form-row">
              <Field label={t('name_az')}>
                <input className="form-input" name="nameAz" required minLength={2} maxLength={200} />
              </Field>
              <Field label={t('name_ru')} optional>
                <input className="form-input" name="nameRu" maxLength={200} />
              </Field>
              <Field label={t('name_en')} optional>
                <input className="form-input" name="nameEn" maxLength={200} />
              </Field>
            </div>
            <div className="form-row">
              <Field label={t('author_type')}>
                <select className="form-input" name="authorType" defaultValue="POET">
                  <Options values={AUTHOR_TYPES} group="atype" />
                </select>
              </Field>
              <Field label={t('born')} optional>
                <YearInput name="bornYear" />
              </Field>
              <Field label={t('died')} optional>
                <YearInput name="diedYear" />
              </Field>
            </div>
            <Field label={t('bio')} optional>
              <textarea className="form-input form-textarea form-textarea--short" name="bio" maxLength={20000} dir="auto" />
            </Field>
          </>
        )}

        {kind !== 'AUTHOR' && (
          <Field label={t('body')} hint={t('body_hint')}>
            <textarea className="form-input form-textarea" name="body" required maxLength={100000} dir="auto" />
          </Field>
        )}
        {kind === 'TRANSLATION' && (
          <Field label={t('translator_note')} optional>
            <textarea className="form-input form-textarea form-textarea--short" name="translatorNote" maxLength={1000} dir="auto" />
          </Field>
        )}
      </fieldset>

      <fieldset className="form-section">
        <legend className="section-label">{t('section_source')}</legend>
        <Field label={t('source')} optional={kind === 'AUTHOR'} hint={t('source_hint')}>
          <input className="form-input" name="sourceNote" required={kind !== 'AUTHOR'} maxLength={500} />
        </Field>
      </fieldset>

      <fieldset className="form-section">
        <legend className="section-label">{t('section_contact')}</legend>
        <div className="form-row">
          <Field label={t('contact_name')}>
            <input className="form-input" name="contactName" required minLength={2} maxLength={100} autoComplete="name" />
          </Field>
          <Field label={t('contact_email')}>
            <input className="form-input" type="email" name="contactEmail" required maxLength={200} autoComplete="email" />
          </Field>
        </div>
        <p className="form-hint">{t('contact_hint')}</p>
        {/* Honeypot: hidden from people, filled in by bots */}
        <div className="form-honeypot" aria-hidden="true">
          <input name="website" tabIndex={-1} autoComplete="off" />
        </div>
      </fieldset>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div>
        <button type="submit" className="btn btn-primary form-submit" disabled={sending}>
          {sending ? t('sending') : t('submit')}
        </button>
      </div>
    </form>
  );
}
