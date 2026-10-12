'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch, KIND_LABELS, SOURCE_LABELS, type TagKind, type TagSource } from '@/lib/adminTags';

interface TagRow {
  slug: string;
  kind: TagKind;
  nameAz: string;
  nameRu: string | null;
  nameEn: string | null;
  counts: Record<TagSource, number>;
}

const KINDS: TagKind[] = ['THEME', 'MOOD', 'AUDIENCE', 'ERA'];
const SOURCES: TagSource[] = ['RULE', 'EDITOR', 'REJECTED'];

export default function AdminTagsPage() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminFetch<TagRow[]>('/tags/admin/overview')
      .then(setTags)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Teqlər</h1>
          <p className="adm-subtitle">
            Qaydalar teqləri açar sözlərə görə verir. Redaktorun təsdiqlədiyi və rədd etdiyi teqlər qaydalar yenidən
            işlədikdə dəyişmir.
          </p>
        </div>
      </div>

      {error && <p className="adm-notice adm-notice--error">{error}</p>}
      {loading ? (
        <div className="adm-loading">Yüklənir…</div>
      ) : (
        KINDS.map((kind) => (
          <section key={kind} className="adm-tag-group">
            <h2 className="adm-section-hdr">{KIND_LABELS[kind]}</h2>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Teq</th>
                  <th>RU / EN</th>
                  {SOURCES.map((s) => (
                    <th key={s} className="right" title={SOURCE_LABELS[s].hint}>{SOURCE_LABELS[s].label}</th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tags
                  .filter((tag) => tag.kind === kind)
                  .map((tag) => (
                    <tr key={tag.slug}>
                      <td className="bold">
                        <Link href={`/admin/tags/${tag.slug}`}>{tag.nameAz}</Link>
                      </td>
                      <td className="muted">{tag.nameRu} · {tag.nameEn}</td>
                      {SOURCES.map((s) => (
                        <td key={s} className="right adm-num">
                          {tag.counts[s] ? (
                            <Link href={`/admin/tags/${tag.slug}?source=${s}`}>{tag.counts[s]}</Link>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      ))}
                      <td className="right">
                        <Link href={`/admin/tags/${tag.slug}`} className="adm-btn adm-btn-sec">Əsərlər</Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  );
}
