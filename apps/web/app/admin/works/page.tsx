'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export default function AdminWorksPage() {
  const [works, setWorks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/works?limit=100&all=true`)
      .then((r) => r.json())
      .then((data) => {
        setWorks(data.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Əsərlər</h1>
          <p className="adm-subtitle">{works.length} əsər</p>
        </div>
        <Link href="/admin/works/new" className="adm-btn adm-btn-pom">
          + Yeni əsər
        </Link>
      </div>

      {loading ? (
        <div className="adm-loading">Yüklənir…</div>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Başlıq</th>
              <th>Müəllif</th>
              <th>Kolleksiya</th>
              <th>Janr</th>
              <th>Dil</th>
              <th>İl</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {works.map((w) => (
              <tr key={w.id}>
                <td className="bold">{w.titleAz}</td>
                <td className="muted">{w.author?.nameAz}</td>
                <td className="muted">{w.collection?.titleAz || '—'}</td>
                <td>
                  <span className="pill" style={{ fontSize: '0.6rem', cursor: 'default' }}>
                    {w.genre}
                    {w.form && ` · ${w.form}`}
                  </span>
                </td>
                <td>
                  <span className="pill" style={{ fontSize: '0.55rem', cursor: 'default' }}>
                    {w.originalLang}
                  </span>
                </td>
                <td className="muted">
                  {w.yearApprox && '~'}
                  {w.year ?? '—'}
                </td>
                <td>
                  <Link href={`/admin/works/${w.id}`} className="adm-btn adm-btn-sec">
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
