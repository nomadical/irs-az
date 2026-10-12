'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { adminFetch, setWorkTags, SOURCE_LABELS, type TagSource } from '@/lib/adminTags';

interface Assignment {
  source: TagSource;
  work: { id: string; slug: string; titleAz: string; status: string; author: { nameAz: string } };
}

interface AssignmentsResponse {
  tag: { slug: string; nameAz: string };
  data: Assignment[];
  meta: { total: number; page: number; totalPages: number };
}

const FILTERS: { key: '' | TagSource; label: string }[] = [
  { key: '', label: 'Hamısı' },
  { key: 'RULE', label: 'Avto' },
  { key: 'EDITOR', label: 'Redaktor' },
  { key: 'REJECTED', label: 'Rədd edilib' },
];

export default function AdminTagPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = (searchParams.get('source') ?? '') as '' | TagSource;
  const page = Number(searchParams.get('page')) || 1;

  const [result, setResult] = useState<AssignmentsResponse | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const qp = new URLSearchParams({ page: String(page) });
    if (source) qp.set('source', source);
    if (query) qp.set('q', query);
    adminFetch<AssignmentsResponse>(`/tags/${slug}/assignments?${qp}`)
      .then(setResult)
      .catch((e) => setError(e.message));
  }, [slug, source, page, query]);

  useEffect(load, [load]);

  // Search applies after typing pauses
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const go = (next: { source?: string; page?: number }) => {
    const qp = new URLSearchParams();
    const s = next.source ?? source;
    if (s) qp.set('source', s);
    if (next.page && next.page > 1) qp.set('page', String(next.page));
    router.push(`/admin/tags/${slug}${qp.size ? `?${qp}` : ''}`);
  };

  const change = async (workId: string, action: 'add' | 'remove') => {
    setBusy(workId);
    setError('');
    try {
      const tags = await setWorkTags(workId, { [action]: [slug] });
      const now = tags.find((t) => t.tag.slug === slug)?.source;
      setResult((r) =>
        r && now
          ? { ...r, data: r.data.map((a) => (a.work.id === workId ? { ...a, source: now } : a)) }
          : r,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <p className="adm-subtitle"><Link href="/admin/tags">← Teqlər</Link></p>
          <h1 className="adm-page-title">{result?.tag.nameAz ?? slug}</h1>
          <p className="adm-subtitle">{result ? `${result.meta.total} əsər` : ' '}</p>
        </div>
        <a href={`/az/tags/${slug}`} className="adm-btn adm-btn-sec" target="_blank" rel="noreferrer">
          Saytda bax ↗
        </a>
      </div>

      <div className="adm-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`adm-tab ${source === f.key ? 'active' : ''}`}
            onClick={() => go({ source: f.key, page: 1 })}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="adm-toolbar">
        <input
          type="search"
          className="adm-search"
          placeholder="Başlığa görə axtar…"
          aria-label="Başlığa görə axtar"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="adm-notice adm-notice--error">{error}</p>}

      {!result ? (
        <div className="adm-loading">Yüklənir…</div>
      ) : result.data.length === 0 ? (
        <p className="adm-empty">Bu süzgəcə uyğun əsər yoxdur.</p>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Əsər</th>
              <th>Müəllif</th>
              <th>Mənbə</th>
              <th className="right">Əməliyyat</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map(({ source: s, work }) => (
              <tr key={work.id}>
                <td className="bold">
                  <Link href={`/admin/works/${work.id}`}>{work.titleAz}</Link>
                  {work.status !== 'PUBLISHED' && <span className="muted"> · qaralama</span>}
                </td>
                <td className="muted">{work.author.nameAz}</td>
                <td>
                  <span className={`badge ${SOURCE_LABELS[s].badge}`} title={SOURCE_LABELS[s].hint}>
                    {SOURCE_LABELS[s].label}
                  </span>
                </td>
                <td className="right adm-row-actions">
                  {s === 'RULE' && (
                    <button type="button" className="adm-btn adm-btn-ok" disabled={busy === work.id} onClick={() => change(work.id, 'add')}>
                      Təsdiqlə
                    </button>
                  )}
                  {s === 'REJECTED' ? (
                    <button type="button" className="adm-btn adm-btn-sec" disabled={busy === work.id} onClick={() => change(work.id, 'add')}>
                      Bərpa et
                    </button>
                  ) : (
                    <button type="button" className="adm-btn adm-btn-no" disabled={busy === work.id} onClick={() => change(work.id, 'remove')}>
                      Sil
                    </button>
                  )}
                  <a href={`/az/works/${work.slug}`} className="adm-btn adm-btn-sec" target="_blank" rel="noreferrer">↗</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
