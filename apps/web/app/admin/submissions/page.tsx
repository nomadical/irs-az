'use client';

import { Fragment, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const TABS = [
  { key: '', label: 'Hamısı' },
  { key: 'PENDING', label: 'Gözləyən' },
  { key: 'APPROVED', label: 'Təsdiqlənən' },
  { key: 'REJECTED', label: 'Rədd edilən' },
  { key: 'CHANGES_REQUESTED', label: 'Dəyişiklik' },
];

const statusBadge: Record<string, string> = {
  PENDING: 'badge--pending',
  APPROVED: 'badge--approved',
  REJECTED: 'badge--rejected',
  CHANGES_REQUESTED: 'badge--info',
};

const statusLabel: Record<string, string> = {
  PENDING: 'Gözləyir',
  APPROVED: 'Təsdiqləndi',
  REJECTED: 'Rədd edildi',
  CHANGES_REQUESTED: 'Dəyişiklik',
};

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; href?: string; linkText?: string; error?: boolean } | null>(null);
  // Editor's note per submission, sent with reject / request-changes
  const [notes, setNotes] = useState<Record<string, string>>({});

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const loadSubmissions = () => {
    setLoading(true);
    const statusParam = filter ? `status=${filter}&` : '';
    fetch(`${API}/submissions?${statusParam}limit=50`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        setSubmissions(data.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadSubmissions();
  }, [filter]);

  /** Public contributors have no account, so the note reaches them only by email */
  const mailtoContributor = (sub: any, note: string) =>
    sub.contactEmail
      ? `mailto:${sub.contactEmail}?subject=${encodeURIComponent('IRS.AZ: təklifiniz haqqında')}&body=${encodeURIComponent(note)}`
      : undefined;

  const handleAction = async (sub: any, action: 'approve' | 'reject' | 'request-changes') => {
    const id = sub.id;
    const reviewNote = (notes[id] ?? '').trim();
    setActionLoading(id);
    setNotice(null);
    try {
      const res = await fetch(`${API}/submissions/${id}/${action}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: action === 'approve' ? undefined : JSON.stringify({ reviewNote }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ text: `Xəta: ${result.message ?? res.status}`, error: true });
      } else {
        if (action === 'approve' && result.slug) {
          const path = result.type === 'AUTHOR' ? 'authors' : 'works';
          setNotice({ text: 'Təsdiqləndi və dərc olundu.', href: `/az/${path}/${result.slug}`, linkText: 'Saytda bax →' });
        } else if (action !== 'approve') {
          setNotice({
            text: action === 'reject' ? 'Rədd edildi.' : 'Dəyişiklik istəndi.',
            href: reviewNote ? mailtoContributor(sub, reviewNote) : undefined,
            linkText: 'Müəllifə e-poçtla yaz →',
          });
        }
        setNotes(({ [id]: _, ...rest }) => rest);
        loadSubmissions();
        setExpandedId(null);
      }
    } catch {
      setNotice({ text: 'Xəta: serverə qoşulmaq alınmadı.', error: true });
    }
    setActionLoading(null);
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('az-AZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const getTitle = (sub: any) =>
    (sub.payload as any)?.nameAz ||
    (sub.payload as any)?.titleAz ||
    'Təqdimat';

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Təqdimatlar</h1>
          <p className="adm-subtitle">İctimai təqdimatları idarə edin</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="adm-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`adm-tab ${filter === tab.key ? 'active' : ''}`}
            onClick={() => {
              setFilter(tab.key);
              setExpandedId(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className={`adm-notice${notice.error ? ' adm-notice--error' : ''}`} role="status">
          {notice.text}
          {notice.href && (
            <>
              {' '}
              <a href={notice.href} target="_blank" rel="noopener noreferrer">
                {notice.linkText}
              </a>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="adm-loading">Yüklənir…</div>
      ) : submissions.length === 0 ? (
        <div className="adm-empty">Heç bir təqdimat yoxdur.</div>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Başlıq</th>
              <th>Növ</th>
              <th>Müəllif</th>
              <th>İstifadəçi</th>
              <th>Tarix</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((sub) => (
              <Fragment key={sub.id}>
                <tr>
                  <td className="bold">{getTitle(sub)}</td>
                  <td>
                    <span className="badge badge--info">{sub.type}</span>
                  </td>
                  <td className="muted">
                    {(sub.payload as any)?.authorName || '—'}
                  </td>
                  <td className="muted">
                    {sub.user?.name || sub.user?.username || (
                      <a href={`mailto:${sub.contactEmail}`}>{sub.contactName}</a>
                    )}
                  </td>
                  <td className="muted">{formatDate(sub.createdAt)}</td>
                  <td>
                    <span className={`badge ${statusBadge[sub.status] ?? ''}`}>
                      {statusLabel[sub.status] ?? sub.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="adm-expand-btn"
                      onClick={() =>
                        setExpandedId(expandedId === sub.id ? null : sub.id)
                      }
                    >
                      {expandedId === sub.id ? '−' : '+'}
                    </button>
                  </td>
                </tr>
                {expandedId === sub.id && (
                  <tr>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <div className="adm-detail">
                        <div className="adm-detail-meta">
                          <span>Növ: {sub.type}</span>
                          <span>Dil: {(sub.payload as any)?.language || (sub.payload as any)?.originalLang || '—'}</span>
                          <span>Tarix: {formatDate(sub.createdAt)}</span>
                        </div>
                        {(sub.payload as any)?.body && (
                          <div className="adm-detail-body">
                            {(sub.payload as any).body}
                          </div>
                        )}
                        {(sub.payload as any)?.sourceNote && (
                          <div className="adm-detail-source">
                            Mənbə: {(sub.payload as any).sourceNote}
                          </div>
                        )}
                        {sub.reviewNote && (
                          <div className="adm-detail-source">
                            Redaktor qeydi: {sub.reviewNote}
                          </div>
                        )}
                        {(sub.status === 'PENDING' || sub.status === 'CHANGES_REQUESTED') && (
                          <label className="adm-field adm-review-note">
                            <span className="adm-label">Redaktor qeydi (müəllifə)</span>
                            <textarea
                              className="adm-textarea"
                              rows={3}
                              maxLength={2000}
                              placeholder="Nəyi düzəltmək lazımdır və ya niyə rədd edilir"
                              value={notes[sub.id] ?? ''}
                              onChange={(e) => setNotes((n) => ({ ...n, [sub.id]: e.target.value }))}
                            />
                          </label>
                        )}
                        {(sub.status === 'PENDING' || sub.status === 'CHANGES_REQUESTED') && (
                          <div className="adm-detail-actions">
                            <button
                              className="adm-btn adm-btn-ok"
                              disabled={actionLoading === sub.id}
                              onClick={() => handleAction(sub, 'approve')}
                            >
                              Təsdiqlə və dərc et
                            </button>
                            <button
                              className="adm-btn adm-btn-warn"
                              disabled={actionLoading === sub.id || !(notes[sub.id] ?? '').trim()}
                              title="Qeyd yazın: müəllif nəyi düzəltməlidir"
                              onClick={() => handleAction(sub, 'request-changes')}
                            >
                              Dəyişiklik istəyin
                            </button>
                            <button
                              className="adm-btn adm-btn-no"
                              disabled={actionLoading === sub.id}
                              onClick={() => handleAction(sub, 'reject')}
                            >
                              Rədd edin
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
