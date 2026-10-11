'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export default function NewAuthorPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nameAz: '',
    nameRu: '',
    nameEn: '',
    nameFa: '',
    type: 'POET',
    period: '',
    bornYear: '',
    bornYearApprox: false,
    diedYear: '',
    diedYearApprox: false,
    bornPlace: '',
    diedPlace: '',
    bioAz: '',
    bioRu: '',
    portraitUrl: '',
  });

  const update = (field: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const save = async (status: 'DRAFT' | 'PUBLISHED') => {
    setSaving(true);
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Giriş tələb olunur.');
      setSaving(false);
      return;
    }

    const payload = {
      nameAz: form.nameAz,
      nameRu: form.nameRu || undefined,
      nameEn: form.nameEn || undefined,
      nameFa: form.nameFa || undefined,
      type: form.type,
      period: form.period || undefined,
      bornYear: form.bornYear ? Number(form.bornYear) : undefined,
      bornYearApprox: form.bornYearApprox,
      diedYear: form.diedYear ? Number(form.diedYear) : undefined,
      diedYearApprox: form.diedYearApprox,
      bornPlace: form.bornPlace || undefined,
      diedPlace: form.diedPlace || undefined,
      bioAz: form.bioAz || undefined,
      bioRu: form.bioRu || undefined,
      portraitUrl: form.portraitUrl || undefined,
      status,
    };

    try {
      const res = await fetch(`${API}/authors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push('/admin/authors');
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
          <h1 className="adm-page-title">Yeni müəllif</h1>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="button" className="adm-btn adm-btn-sec" onClick={() => router.push('/admin/authors')}>
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
          <div>
            <div className="adm-field">
              <label className="adm-label">Ad (AZ) *</label>
              <input className="adm-input" value={form.nameAz} onChange={(e) => update('nameAz', e.target.value)} required />
            </div>
            <div className="adm-field">
              <label className="adm-label">Ad (RU)</label>
              <input className="adm-input" value={form.nameRu} onChange={(e) => update('nameRu', e.target.value)} />
            </div>
            <div className="adm-field">
              <label className="adm-label">Ad (EN)</label>
              <input className="adm-input" value={form.nameEn} onChange={(e) => update('nameEn', e.target.value)} />
            </div>
            <div className="adm-field">
              <label className="adm-label">Ad (FA)</label>
              <input className="adm-input" value={form.nameFa} onChange={(e) => update('nameFa', e.target.value)} dir="rtl" />
            </div>
            <div className="adm-field">
              <label className="adm-label">Növ</label>
              <select className="adm-select" value={form.type} onChange={(e) => update('type', e.target.value)}>
                {['POET', 'WRITER', 'PLAYWRIGHT', 'PHILOSOPHER'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="adm-field">
              <label className="adm-label">Dövr</label>
              <input className="adm-input" value={form.period} onChange={(e) => update('period', e.target.value)} placeholder="XII əsr" />
            </div>
            <div className="adm-field-row">
              <div className="adm-field">
                <label className="adm-label">Doğum ili</label>
                <input className="adm-input" type="number" value={form.bornYear} onChange={(e) => update('bornYear', e.target.value)} />
              </div>
              <div className="adm-field">
                <label className="adm-label">Vəfat ili</label>
                <input className="adm-input" type="number" value={form.diedYear} onChange={(e) => update('diedYear', e.target.value)} />
              </div>
            </div>
            <div className="adm-field" style={{ display: 'flex', gap: '1rem' }}>
              <label className="adm-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="checkbox" checked={form.bornYearApprox} onChange={(e) => update('bornYearApprox', e.target.checked)} />
                Təxmini doğum
              </label>
              <label className="adm-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="checkbox" checked={form.diedYearApprox} onChange={(e) => update('diedYearApprox', e.target.checked)} />
                Təxmini vəfat
              </label>
            </div>
            <div className="adm-field">
              <label className="adm-label">Doğum yeri</label>
              <input className="adm-input" value={form.bornPlace} onChange={(e) => update('bornPlace', e.target.value)} />
            </div>
            <div className="adm-field">
              <label className="adm-label">Vəfat yeri</label>
              <input className="adm-input" value={form.diedPlace} onChange={(e) => update('diedPlace', e.target.value)} />
            </div>
            <div className="adm-field">
              <label className="adm-label">Portret URL</label>
              <input className="adm-input" value={form.portraitUrl} onChange={(e) => update('portraitUrl', e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div>
            <div className="adm-field">
              <label className="adm-label">Bioqrafiya (AZ, Markdown)</label>
              <textarea
                className="adm-textarea"
                value={form.bioAz}
                onChange={(e) => update('bioAz', e.target.value)}
                style={{ minHeight: '250px' }}
              />
            </div>
            <div className="adm-field">
              <label className="adm-label">Bioqrafiya (RU, Markdown)</label>
              <textarea
                className="adm-textarea"
                value={form.bioRu}
                onChange={(e) => update('bioRu', e.target.value)}
                style={{ minHeight: '250px' }}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
