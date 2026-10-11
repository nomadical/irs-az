'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const TYPE_FILTERS = [
  { key: '', label: 'Hamısı' },
  { key: 'POET', label: 'Şair' },
  { key: 'WRITER', label: 'Yazıçı' },
  { key: 'PHILOSOPHER', label: 'Filosof' },
];

export default function AdminAuthorsPage() {
  const [authors, setAuthors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    fetch(`${API}/authors?limit=100&all=true`)
      .then((r) => r.json())
      .then((data) => {
        setAuthors(data.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return authors.filter((a) => {
      const matchesSearch =
        !search ||
        a.nameAz?.toLowerCase().includes(search.toLowerCase()) ||
        a.nameRu?.toLowerCase().includes(search.toLowerCase()) ||
        a.nameEn?.toLowerCase().includes(search.toLowerCase());
      const matchesType = !typeFilter || a.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [authors, search, typeFilter]);

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Müəlliflər</h1>
          <p className="adm-subtitle">{authors.length} müəllif</p>
        </div>
        <Link href="/admin/authors/new" className="adm-btn adm-btn-pom">
          + Yeni müəllif
        </Link>
      </div>

      <div className="adm-toolbar">
        <input
          type="text"
          className="adm-search"
          placeholder="Axtar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key}
            className={`adm-btn ${typeFilter === f.key ? 'adm-btn-pom' : 'adm-btn-sec'}`}
            onClick={() => setTypeFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="adm-loading">Yüklənir…</div>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Dövr</th>
              <th>Növ</th>
              <th>Əsərlər</th>
              <th>Dillər</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td className="bold">
                  {a.nameAz}
                  {a.nameRu && (
                    <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: '0.4rem', fontSize: '0.7rem' }}>
                      {a.nameRu}
                    </span>
                  )}
                </td>
                <td className="muted">{a.period}</td>
                <td>
                  <span className="pill" style={{ fontSize: '0.6rem', cursor: 'default' }}>
                    {a.type}
                  </span>
                </td>
                <td className="right" style={{ fontWeight: 600 }}>
                  {a._count?.works ?? 0}
                </td>
                <td>
                  {a.writingLangs?.map((l: string) => (
                    <span
                      key={l}
                      className="pill"
                      style={{ fontSize: '0.55rem', marginRight: '0.15rem', cursor: 'default' }}
                    >
                      {l.replace('AZ_', '').replace('_', ' ')}
                    </span>
                  ))}
                </td>
                <td>
                  <span
                    className={`adm-dot ${a.status === 'PUBLISHED' ? 'adm-dot--on' : 'adm-dot--off'}`}
                  />
                </td>
                <td>
                  <Link href={`/admin/authors/${a.id}`} className="adm-btn adm-btn-sec">
                    Redaktə
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
