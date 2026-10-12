'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { WorkTagEditor } from '@/components/admin/WorkTagEditor';
import type { TagSource } from '@/lib/adminTags';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export default function EditWorkPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [authors, setAuthors] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<{ source: TagSource; tag: { slug: string } }[]>([]);

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
    status: 'DRAFT',
  });

  // Load authors list
  useEffect(() => {
    fetch(`${API}/authors?limit=100&all=true`)
      .then((r) => r.json())
      .then((data) => setAuthors(data.data ?? []));
  }, []);

  // Load work data (admin endpoint, returns any status)
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API}/works/by-id/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (r.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/admin/login';
          throw new Error('Unauthorized');
        }
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data) => {
        setForm({
          titleAz: data.titleAz ?? '',
          titleRu: data.titleRu ?? '',
          titleFa: data.titleFa ?? '',
          body: data.body ?? '',
          authorId: data.authorId ?? '',
          collectionId: data.collectionId ?? '',
          originalLang: data.originalLang ?? 'AZ_LATIN',
          genre: data.genre ?? 'POEM',
          form: data.form ?? '',
          year: data.year != null ? String(data.year) : '',
          yearApprox: data.yearApprox ?? false,
          order: data.order != null ? String(data.order) : '',
          sourceNote: data.sourceNote ?? '',
          status: data.status ?? 'DRAFT',
        });
        setTags(data.tags ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  // Load collections when author changes
  useEffect(() => {
    if (form.authorId && authors.length > 0) {
      const author = authors.find((a) => a.id === form.authorId);
      if (author) {
        fetch(`${API}/authors/${author.slug}`)
          .then((r) => r.json())
          .then((data) => setCollections(data.collections ?? []));
      }
    }
  }, [form.authorId, authors]);

  const update = (field: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const save = async (status?: string) => {
    setSaving(true);
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Giriş tələb olunur.');
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      titleAz: form.titleAz,
      titleRu: form.titleRu || undefined,
      titleFa: form.titleFa || undefined,
      body: form.body,
      authorId: form.authorId,
      collectionId: form.collectionId || undefined,
      originalLang: form.originalLang,
      genre: form.genre,
      form: form.form || undefined,
      year: form.year ? Number(form.year) : undefined,
      yearApprox: form.yearApprox,
      order: form.order ? Number(form.order) : undefined,
      sourceNote: form.sourceNote || undefined,
    };
    if (status) payload.status = status;

    try {
      const res = await fetch(`${API}/works/${id}`, {
        method: 'PATCH',
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
    await save();
  };

  if (loading) return <div className="adm-loading">Yüklənir…</div>;

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="adm-page-header">
          <h1 className="adm-page-title">Əsəri redaktə et</h1>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="button" className="adm-btn adm-btn-sec" onClick={() => router.push('/admin/works')}>
              Ləğv et
            </button>
            {form.status !== 'PUBLISHED' && (
              <button type="button" className="adm-btn adm-btn-pom" disabled={saving} onClick={() => save('PUBLISHED')}>
                Yayımla
              </button>
            )}
            {form.status === 'PUBLISHED' && (
              <button type="button" className="adm-btn adm-btn-sec" disabled={saving} onClick={() => save('DRAFT')}>
                Qaralamaya qaytar
              </button>
            )}
            <button type="submit" className="adm-btn" disabled={saving}>
              {saving ? 'Saxlanılır…' : 'Yadda saxla'}
            </button>
          </div>
        </div>

        <div className="adm-editor-grid">
          <div>
            <div className="adm-field">
              <label className="adm-label">Başlıq (AZ) *</label>
              <input className="adm-input" value={form.titleAz} onChange={(e) => update('titleAz', e.target.value)} required />
            </div>
            <div className="adm-field">
              <label className="adm-label">Başlıq (RU)</label>
              <input className="adm-input" value={form.titleRu} onChange={(e) => update('titleRu', e.target.value)} />
            </div>
            <div className="adm-field">
              <label className="adm-label">Başlıq (FA)</label>
              <input className="adm-input" value={form.titleFa} onChange={(e) => update('titleFa', e.target.value)} dir="rtl" />
            </div>
            <div className="adm-field">
              <label className="adm-label">Müəllif *</label>
              <select className="adm-select" value={form.authorId} onChange={(e) => update('authorId', e.target.value)} required>
                <option value="">Seçin…</option>
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>{a.nameAz}</option>
                ))}
              </select>
            </div>
            <div className="adm-field">
              <label className="adm-label">Kolleksiya</label>
              <select className="adm-select" value={form.collectionId} onChange={(e) => update('collectionId', e.target.value)}>
                <option value="">Müstəqil əsər</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.titleAz}</option>
                ))}
              </select>
            </div>
            <div className="adm-field-row">
              <div className="adm-field">
                <label className="adm-label">Sıra</label>
                <input className="adm-input" type="number" value={form.order} onChange={(e) => update('order', e.target.value)} placeholder="#" />
              </div>
              <div className="adm-field">
                <label className="adm-label">İl</label>
                <input className="adm-input" type="number" value={form.year} onChange={(e) => update('year', e.target.value)} />
              </div>
            </div>
            <div className="adm-field">
              <label className="adm-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="checkbox" checked={form.yearApprox} onChange={(e) => update('yearApprox', e.target.checked)} />
                Təxmini il
              </label>
            </div>
            <div className="adm-field">
              <label className="adm-label">Janr</label>
              <select className="adm-select" value={form.genre} onChange={(e) => update('genre', e.target.value)}>
                {['POEM', 'PROSE', 'PLAY', 'ESSAY', 'PHILOSOPHY', 'LETTER', 'MEMOIR'].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="adm-field">
              <label className="adm-label">Orijinal dil</label>
              <select className="adm-select" value={form.originalLang} onChange={(e) => update('originalLang', e.target.value)}>
                {['AZ_LATIN', 'AZ_ARABIC', 'AZ_CYRILLIC', 'FA', 'AR', 'RU', 'TR'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="adm-field">
              <label className="adm-label">Mənbə qeydi</label>
              <input className="adm-input" value={form.sourceNote} onChange={(e) => update('sourceNote', e.target.value)} />
            </div>
            <WorkTagEditor workId={id} initial={tags} />
          </div>

          <div>
            <div className="adm-field">
              <label className="adm-label">Mətn (Markdown) *</label>
              <textarea
                className="adm-textarea"
                value={form.body}
                onChange={(e) => update('body', e.target.value)}
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
