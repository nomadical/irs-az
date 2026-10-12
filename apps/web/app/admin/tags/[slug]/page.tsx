'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { adminFetch, bulkSetTag, SOURCE_LABELS, type TagSource } from '@/lib/adminTags';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

interface Row {
  /** This tag's state on the work; null when the work doesn't have it */
  source: TagSource | null;
  work: { id: string; slug: string; titleAz: string; status: string; author: { nameAz: string } };
}

interface Page {
  data: Row[];
  meta: { total: number; page: number; totalPages: number };
}

type Mode = '' | TagSource | 'add';

const TABS: { key: Mode; label: string }[] = [
  { key: '', label: 'Hamısı' },
  { key: 'RULE', label: 'Avto' },
  { key: 'EDITOR', label: 'Redaktor' },
  { key: 'REJECTED', label: 'Rədd edilib' },
  { key: 'add', label: '+ Əsər əlavə et' },
];

const hasTag = (s: TagSource | null) => s === 'RULE' || s === 'EDITOR';

export default function AdminTagPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = (searchParams.get('mode') === 'add' ? 'add' : searchParams.get('source') ?? '') as Mode;
  const page = Number(searchParams.get('page')) || 1;
  const adding = mode === 'add';

  const [tagName, setTagName] = useState(slug);
  const [authors, setAuthors] = useState<{ slug: string; nameAz: string }[]>([]);
  const [result, setResult] = useState<Page | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [author, setAuthor] = useState('');
  const [untaggedOnly, setUntaggedOnly] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetch(`${API}/tags/${slug}`).then((r) => r.json()).then((t) => t.nameAz && setTagName(t.nameAz)).catch(() => {});
    fetch(`${API}/authors?limit=100&all=true`)
      .then((r) => r.json())
      .then((d) => setAuthors((d.data ?? []).sort((a: any, b: any) => a.nameAz.localeCompare(b.nameAz, 'az'))))
      .catch(() => {});
  }, [slug]);

  const load = useCallback(() => {
    setResult(null);
    const qp = new URLSearchParams({ page: String(page) });
    if (query) qp.set('q', query);
    if (adding) {
      if (author) qp.set('author', author);
      if (untaggedOnly) qp.set('untagged', 'true');
    } else if (mode) qp.set('source', mode);
    adminFetch<Page>(`/tags/${slug}/${adding ? 'candidates' : 'assignments'}?${qp}`)
      .then(setResult)
      .catch((e) => setError(e.message));
  }, [slug, mode, adding, page, query, author, untaggedOnly]);

  useEffect(load, [load]);
  useEffect(() => setSelected(new Set()), [mode, page, query, author, untaggedOnly]);

  // Search applies after typing pauses
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const go = (next: { mode?: Mode; page?: number }) => {
    const m = next.mode ?? mode;
    const qp = new URLSearchParams();
    if (m === 'add') qp.set('mode', 'add');
    else if (m) qp.set('source', m);
    if (next.page && next.page > 1) qp.set('page', String(next.page));
    router.push(`/admin/tags/${slug}${qp.size ? `?${qp}` : ''}`);
  };

  // In "add" mode a work that already has the tag can't be picked
  const selectable = useMemo(
    () => (result?.data ?? []).filter((r) => (adding ? !hasTag(r.source) : true)).map((r) => r.work.id),
    [result, adding],
  );
  const allSelected = selectable.length > 0 && selectable.every((id) => selected.has(id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Apply a change to the given works, then update their rows in place */
  const apply = async (ids: string[], action: 'add' | 'remove') => {
    if (!ids.length) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await bulkSetTag(slug, { [action]: ids });
      const now: TagSource = action === 'add' ? 'EDITOR' : 'REJECTED';
      setResult((r) => r && { ...r, data: r.data.map((row) => (ids.includes(row.work.id) ? { ...row, source: now } : row)) });
      setSelected(new Set());
      setNotice(action === 'add' ? `${res.added} əsərə «${tagName}» teqi əlavə edildi` : `${res.removed} əsərdən «${tagName}» teqi silindi`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const selectedIds = [...selected];
  const selectedRules = (result?.data ?? []).filter((r) => selected.has(r.work.id) && r.source === 'RULE').map((r) => r.work.id);

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <p className="adm-subtitle"><Link href="/admin/tags">← Teqlər</Link></p>
          <h1 className="adm-page-title">{tagName}</h1>
          <p className="adm-subtitle">
            {result ? `${result.meta.total} ${adding ? 'uyğun əsər' : 'əsər'}` : ' '}
          </p>
        </div>
        <a href={`/az/tags/${slug}`} className="adm-btn adm-btn-sec" target="_blank" rel="noreferrer">
          Saytda bax ↗
        </a>
      </div>

      <div className="adm-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`adm-tab ${mode === tab.key ? 'active' : ''}`}
            onClick={() => go({ mode: tab.key, page: 1 })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="adm-toolbar adm-toolbar--wrap">
        <input
          type="search"
          className="adm-search"
          placeholder={adding ? 'Başlığa görə tap (ə, ş… olmadan da)…' : 'Başlığa görə axtar…'}
          aria-label="Başlığa görə axtar"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {adding && (
          <>
            <select className="adm-select adm-select--inline" value={author} onChange={(e) => setAuthor(e.target.value)} aria-label="Müəllif">
              <option value="">Bütün müəlliflər</option>
              {authors.map((a) => (
                <option key={a.slug} value={a.slug}>{a.nameAz}</option>
              ))}
            </select>
            <label className="adm-check">
              <input type="checkbox" checked={untaggedOnly} onChange={(e) => setUntaggedOnly(e.target.checked)} />
              Yalnız teqi olmayanlar
            </label>
          </>
        )}
      </div>

      {error && <p className="adm-notice adm-notice--error">{error}</p>}
      {notice && <p className="adm-notice" role="status">{notice}</p>}

      {!result ? (
        <div className="adm-loading">Yüklənir…</div>
      ) : result.data.length === 0 ? (
        <p className="adm-empty">{adding ? 'Axtarışa uyğun əsər yoxdur.' : 'Bu süzgəcə uyğun əsər yoxdur.'}</p>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th className="adm-col-check">
                <input
                  type="checkbox"
                  aria-label="Səhifədəkilərin hamısını seç"
                  checked={allSelected}
                  disabled={!selectable.length}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(selectable))}
                />
              </th>
              <th>Əsər</th>
              <th>Müəllif</th>
              <th>Vəziyyət</th>
              <th className="right">Əməliyyat</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map(({ source: s, work }) => {
              const pickable = adding ? !hasTag(s) : true;
              return (
                <tr key={work.id} className={selected.has(work.id) ? 'is-selected' : undefined}>
                  <td className="adm-col-check">
                    <input
                      type="checkbox"
                      aria-label={`Seç: ${work.titleAz}`}
                      checked={selected.has(work.id)}
                      disabled={!pickable || busy}
                      onChange={() => toggle(work.id)}
                    />
                  </td>
                  <td className="bold">
                    <Link href={`/admin/works/${work.id}`}>{work.titleAz}</Link>
                    {work.status !== 'PUBLISHED' && <span className="muted"> · qaralama</span>}
                  </td>
                  <td className="muted">{work.author.nameAz}</td>
                  <td>
                    {s ? (
                      <span className={`badge ${SOURCE_LABELS[s].badge}`} title={SOURCE_LABELS[s].hint}>
                        {SOURCE_LABELS[s].label}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="right adm-row-actions">
                    {s === 'RULE' && (
                      <button type="button" className="adm-btn adm-btn-ok" disabled={busy} onClick={() => apply([work.id], 'add')}>
                        Təsdiqlə
                      </button>
                    )}
                    {hasTag(s) ? (
                      <button type="button" className="adm-btn adm-btn-no" disabled={busy} onClick={() => apply([work.id], 'remove')}>
                        Sil
                      </button>
                    ) : (
                      <button type="button" className="adm-btn adm-btn-sec" disabled={busy} onClick={() => apply([work.id], 'add')}>
                        {s === 'REJECTED' ? 'Bərpa et' : 'Əlavə et'}
                      </button>
                    )}
                    <a href={`/az/works/${work.slug}`} className="adm-btn adm-btn-sec" target="_blank" rel="noreferrer" aria-label="Saytda aç">↗</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {selectedIds.length > 0 && (
        <div className="adm-bulkbar" role="region" aria-label="Seçilənlər">
          <span>{selectedIds.length} əsər seçildi</span>
          {adding ? (
            <button type="button" className="adm-btn adm-btn-pom" disabled={busy} onClick={() => apply(selectedIds, 'add')}>
              «{tagName}» teqini əlavə et
            </button>
          ) : (
            <>
              {selectedRules.length > 0 && (
                <button type="button" className="adm-btn adm-btn-ok" disabled={busy} onClick={() => apply(selectedRules, 'add')}>
                  Təsdiqlə ({selectedRules.length})
                </button>
              )}
              <button type="button" className="adm-btn adm-btn-no" disabled={busy} onClick={() => apply(selectedIds, 'remove')}>
                Teqi sil
              </button>
            </>
          )}
          <button type="button" className="adm-btn adm-btn-sec" disabled={busy} onClick={() => setSelected(new Set())}>
            Ləğv et
          </button>
        </div>
      )}

      {result && result.meta.totalPages > 1 && (
        <div className="adm-toolbar adm-pager">
          <button type="button" className="adm-btn adm-btn-sec" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>
            ← Əvvəlki
          </button>
          <span className="muted">{page} / {result.meta.totalPages}</span>
          <button
            type="button"
            className="adm-btn adm-btn-sec"
            disabled={page >= result.meta.totalPages}
            onClick={() => go({ page: page + 1 })}
          >
            Növbəti →
          </button>
        </div>
      )}
    </div>
  );
}
