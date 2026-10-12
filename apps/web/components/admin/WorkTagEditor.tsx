'use client';

import { useEffect, useState } from 'react';
import { adminFetch, KIND_LABELS, setWorkTags, SOURCE_LABELS, type TagKind, type TagSource } from '@/lib/adminTags';

interface TagOption {
  slug: string;
  kind: TagKind;
  nameAz: string;
}

interface Props {
  workId: string;
  /** The work's tag rows as loaded with it, any source */
  initial: { source: TagSource; tag: { slug: string } }[];
}

const KINDS: TagKind[] = ['THEME', 'MOOD', 'AUDIENCE', 'ERA'];

/**
 * Tags for one work, saved on click (separately from the form's Save button).
 * A tag the rules suggested and an editor removed stays visible, struck through.
 */
export function WorkTagEditor({ workId, initial }: Props) {
  const [options, setOptions] = useState<TagOption[]>([]);
  const [state, setState] = useState<Record<string, TagSource>>(
    () => Object.fromEntries(initial.map((t) => [t.tag.slug, t.source])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    adminFetch<TagOption[]>('/tags').then(setOptions).catch((e) => setStatus(e.message));
  }, []);

  const toggle = async (tag: TagOption) => {
    const current = state[tag.slug];
    const on = current === 'RULE' || current === 'EDITOR';
    setBusy(tag.slug);
    setStatus('');
    try {
      const rows = await setWorkTags(workId, on ? { remove: [tag.slug] } : { add: [tag.slug] });
      setState(Object.fromEntries(rows.map((t) => [t.tag.slug, t.source])));
      setStatus(`«${tag.nameAz}» ${on ? 'silindi' : 'əlavə edildi'}`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <fieldset className="adm-field adm-tag-editor">
      <legend className="adm-label">Teqlər</legend>
      <p className="adm-tag-legend">
        {(['RULE', 'EDITOR', 'REJECTED'] as TagSource[]).map((s) => (
          <span key={s} className={`badge ${SOURCE_LABELS[s].badge}`} title={SOURCE_LABELS[s].hint}>
            {SOURCE_LABELS[s].label}
          </span>
        ))}
        <span className="muted">Dəyişiklik dərhal saxlanılır.</span>
      </p>

      {KINDS.map((kind) => {
        const ofKind = options.filter((o) => o.kind === kind);
        if (!ofKind.length) return null;
        return (
          <div key={kind} className="adm-tag-row" role="group" aria-label={KIND_LABELS[kind]}>
            <span className="adm-tag-kind">{KIND_LABELS[kind]}</span>
            {ofKind.map((tag) => {
              const source = state[tag.slug];
              const on = source === 'RULE' || source === 'EDITOR';
              return (
                <button
                  key={tag.slug}
                  type="button"
                  className={`adm-tag-chip${on ? ' on' : ''}${source ? ` is-${source.toLowerCase()}` : ''}`}
                  aria-pressed={on}
                  disabled={busy === tag.slug}
                  title={source ? SOURCE_LABELS[source].hint : 'Əlavə et'}
                  onClick={() => toggle(tag)}
                >
                  {tag.nameAz}
                  {source === 'RULE' && <span className="adm-tag-auto">avto</span>}
                </button>
              );
            })}
          </div>
        );
      })}

      <p className="adm-tag-status" role="status" aria-live="polite">{status}</p>
    </fieldset>
  );
}
