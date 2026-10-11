'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

interface DashboardStats {
  authors: number;
  works: number;
  pendingCount: number;
  recentSubmissions: any[];
  allRecentSubmissions: any[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    authors: 0,
    works: 0,
    pendingCount: 0,
    recentSubmissions: [],
    allRecentSubmissions: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    Promise.all([
      fetch(`${API}/authors?limit=1`, { headers }).then((r) => r.json()),
      fetch(`${API}/works?limit=1`, { headers }).then((r) => r.json()),
      fetch(`${API}/submissions?status=PENDING&limit=5`, { headers }).then((r) => r.json()),
      fetch(`${API}/submissions?limit=10`, { headers }).then((r) => r.json()),
    ])
      .then(([authorsData, worksData, pendingData, allData]) => {
        setStats({
          authors: authorsData.meta?.total ?? 0,
          works: worksData.meta?.total ?? 0,
          pendingCount: pendingData.meta?.total ?? 0,
          recentSubmissions: pendingData.data ?? [],
          allRecentSubmissions: allData.data ?? [],
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('az-AZ', {
      day: 'numeric',
      month: 'short',
    });

  const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString('az-AZ', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const statusLabel: Record<string, string> = {
    PENDING: 'Gözləyir',
    APPROVED: 'Təsdiqləndi',
    REJECTED: 'Rədd edildi',
    CHANGES_REQUESTED: 'Dəyişiklik',
  };

  if (loading) return <div className="adm-loading">Yüklənir…</div>;

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Lövhə</h1>
          <p className="adm-subtitle">Ümumi baxış</p>
        </div>
        <Link href="/admin/works/new" className="adm-btn adm-btn-pom">
          + Yeni əsər
        </Link>
      </div>

      <div className="adm-metrics">
        <Link href="/admin/authors" className="adm-metric">
          <div className="adm-metric-value">{stats.authors}</div>
          <div className="adm-metric-label">Müəlliflər</div>
        </Link>
        <Link href="/admin/works" className="adm-metric">
          <div className="adm-metric-value">{stats.works}</div>
          <div className="adm-metric-label">Əsərlər</div>
        </Link>
        <Link href="/admin/works" className="adm-metric">
          <div className="adm-metric-value">—</div>
          <div className="adm-metric-label">Tərcümələr</div>
        </Link>
        <Link
          href="/admin/submissions"
          className={`adm-metric ${stats.pendingCount > 0 ? 'adm-metric--warn' : ''}`}
        >
          <div className="adm-metric-value">{stats.pendingCount}</div>
          <div className="adm-metric-label">Gözləyən təqdimatlar</div>
        </Link>
      </div>

      <div className="adm-dashboard-grid">
        {/* Left: recent pending submissions */}
        <div>
          <div className="adm-section-hdr">Son təqdimatlar</div>
          {stats.recentSubmissions.length === 0 ? (
            <p className="adm-empty">Gözləyən təqdimat yoxdur</p>
          ) : (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Başlıq</th>
                  <th>Növ</th>
                  <th>İstifadəçi</th>
                  <th>Tarix</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSubmissions.map((sub) => (
                  <tr key={sub.id}>
                    <td className="bold">
                      {(sub.payload as any)?.nameAz ||
                        (sub.payload as any)?.titleAz ||
                        'Təqdimat'}
                    </td>
                    <td>
                      <span className="badge badge--info">{sub.type}</span>
                    </td>
                    <td className="muted">
                      {sub.user?.name || sub.user?.username}
                    </td>
                    <td className="muted">{formatDate(sub.createdAt)}</td>
                    <td>
                      <span className="badge badge--pending">
                        {statusLabel[sub.status] ?? sub.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right: activity feed */}
        <div>
          <div className="adm-section-hdr">Son aktivlik</div>
          {stats.allRecentSubmissions.length === 0 ? (
            <p className="adm-empty">Hələ aktivlik yoxdur</p>
          ) : (
            <div>
              {stats.allRecentSubmissions.map((sub) => (
                <div key={sub.id} className="adm-feed-item">
                  <span className="adm-feed-dot" />
                  <span className="adm-feed-text">
                    <strong>{sub.user?.name || sub.user?.username || '?'}</strong>{' '}
                    {sub.type === 'AUTHOR' ? 'müəllif təqdim etdi' : 'əsər təqdim etdi'}
                    {' — '}
                    <span className={`badge badge--${sub.status === 'APPROVED' ? 'approved' : sub.status === 'REJECTED' ? 'rejected' : sub.status === 'CHANGES_REQUESTED' ? 'info' : 'pending'}`}>
                      {statusLabel[sub.status] ?? sub.status}
                    </span>
                  </span>
                  <span className="adm-feed-time">{formatTime(sub.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
