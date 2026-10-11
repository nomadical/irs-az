'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export default function NewWorkPage() {
  const router = useRouter();
  const [authors, setAuthors] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    titleAz: '',
    titleRu: '',
    titleFa: '',
    body: '',
    authorId: '',
    collectionId: '',
    originalLang: 'AZ_LATIN',
    genre: 'POEM',
    form: '',
    year: '',
    yearApprox: false,
    order: '',
    sourceNote: '',
  });

  useEffect(() => {
    fetch(`${API}/authors?limit=100`)
      .then((r) => r.json())
      .then((data) => setAuthors(data.data ?? []));
  }, []);

  useEffect(() => {
    if (form.authorId) {
      fetch(`${API}/authors/${authors.find((a) => a.id === form.authorId)?.slug}`)
        .then((r) => r.json())
        .then((data) => setCollections(data.collections ?? []));
    }
  }, [form.authorId, authors]);

  const update = (field: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const save = async (status: 'DRAFT' | 'PUBLISHED') => {
    setSaving(true);

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Giriş tələb olunur. /admin/login səhifəsinə keçin.');
      setSaving(false);
      return;
    }

    const payload = {
      ...form,
      year: form.year ? Number(form.year) : undefined,
      order: form.order ? Number(form.order) : undefined,
      collectionId: form.collectionId || undefined,
      form: form.form || undefined,
      sourceNote: form.sourceNote || undefined,
      titleRu: form.titleRu || undefined,
      titleFa: form.titleFa || undefined,
      status,
    };

    try {
      const res = await fetch(`${API}/works`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push('/admin/works');
      } else {
        const err = await res.json().catch(() => null);
        const msg = Array.isArray(err?.message) ? err.message.join(', ') : err?.message ?? 'Naməlum xəta';
        alert(`Xəta: ${msg}`);
        setSaving(false);
      }
    } catch {
      alert('Server ilə əlaqə yoxdur');
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save('PUBLISHED');
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="adm-page-header">
          <h1 className="adm-page-title">Yeni əsər</h1>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="button" className="adm-btn adm-btn-sec" onClick={() => router.push('/admin/works')}>
              Ləğv et
            </button>
            <button type="button" className="adm-btn" disabled={saving} onClick={() => save('DRAFT')}>
              Qaralama saxla
            </button>
            <button type="submit" className="adm-btn adm-btn-pom" disabled={saving}>
              {saving ? 'Saxlanılır…' : 'Yayımla'}
            </button>
          </div>
        </div>

        <div className="adm-editor-grid">
          {/* Left: metadata sidebar */}
          <div>
            <div className="adm-field">
              <label className="adm-label">Başlıq (AZ) *</label>
              <input
                className="adm-input"
                value={form.titleAz}
                onChange={(e) => update('titleAz', e.target.value)}
                required
              />
            </div>
            <div className="adm-field">
              <label className="adm-label">Başlıq (RU)</label>
              <input
                className="adm-input"
                value={form.titleRu}
                onChange={(e) => update('titleRu', e.target.value)}
              />
            </div>
            <div className="adm-field">
              <label className="adm-label">Başlıq (FA)</label>
              <input
                className="adm-input"
                value={form.titleFa}
                onChange={(e) => update('titleFa', e.target.value)}
                dir="rtl"
              />
            </div>
            <div className="adm-field">
              <label className="adm-label">Müəllif *</label>
              <select
                className="adm-select"
                value={form.authorId}
                onChange={(e) => update('authorId', e.target.value)}
                required
              >
                <option value="">Seçin…</option>
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>{a.nameAz}</option>
                ))}
              </select>
            </div>
            <div className="adm-field">
              <label className="adm-label">Kolleksiya</label>
              <select
                className="adm-select"
                value={form.collectionId}
                onChange={(e) => update('collectionId', e.target.value)}
              >
                <option value="">Müstəqil əsər</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.titleAz}</option>
                ))}
              </select>
            </div>
            <div className="adm-field-row">
              <div className="adm-field">
                <label className="adm-label">Sıra</label>
                <input
                  className="adm-input"
                  type="number"
                  value={form.order}
                  onChange={(e) => update('order', e.target.value)}
                  placeholder="#"
                />
              </div>
              <div className="adm-field">
                <label className="adm-label">İl</label>
                <input
                  className="adm-input"
                  type="number"
                  value={form.year}
                  onChange={(e) => update('year', e.target.value)}
                />
              </div>
            </div>
            <div className="adm-field">
              <label className="adm-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="checkbox"
                  checked={form.yearApprox}
                  onChange={(e) => update('yearApprox', e.target.checked)}
                />
                Təxmini il
              </label>
            </div>
            <div className="adm-field">
              <label className="adm-label">Janr</label>
              <select
                className="adm-select"
                value={form.genre}
                onChange={(e) => update('genre', e.target.value)}
              >
                {['POEM', 'PROSE', 'PLAY', 'ESSAY', 'PHILOSOPHY', 'LETTER', 'MEMOIR'].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="adm-field">
              <label className="adm-label">Orijinal dil</label>
              <select
                className="adm-select"
                value={form.originalLang}
                onChange={(e) => update('originalLang', e.target.value)}
              >
                {['AZ_LATIN', 'AZ_ARABIC', 'AZ_CYRILLIC', 'FA', 'AR', 'RU', 'TR'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="adm-field">
              <label className="adm-label">Mənbə qeydi</label>
              <input
                className="adm-input"
                value={form.sourceNote}
                onChange={(e) => update('sourceNote', e.target.value)}
                placeholder="AMEA əlyazmaları, 1982 nəşri"
              />
            </div>
          </div>

          {/* Right: body editor */}
          <div>
            <div className="adm-field">
              <label className="adm-label">Mətn (Markdown) *</label>
              <textarea
                className="adm-textarea"
                value={form.body}
                onChange={(e) => update('body', e.target.value)}
                placeholder="Məni candan usandırdı, cəfadan yar usanmazmı?&#10;Fələklər yandı ahimdən, muradım şəmi yanmazmı?"
                required
                style={{ height: '100%', minHeight: '500px' }}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
