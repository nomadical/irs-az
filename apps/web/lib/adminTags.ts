const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export type TagSource = 'RULE' | 'EDITOR' | 'REJECTED';
export type TagKind = 'THEME' | 'MOOD' | 'AUDIENCE' | 'ERA';

export const KIND_LABELS: Record<TagKind, string> = {
  THEME: 'Mövzu',
  MOOD: 'Əhval',
  AUDIENCE: 'Oxucu və həcm',
  ERA: 'Dövr',
};

export const SOURCE_LABELS: Record<TagSource, { label: string; badge: string; hint: string }> = {
  RULE: { label: 'Avto', badge: 'badge--info', hint: 'Açar söz qaydaları ilə verilib; qaydalar yenidən işlədikdə dəyişə bilər' },
  EDITOR: { label: 'Redaktor', badge: 'badge--approved', hint: 'Redaktor təsdiqləyib; qaydalar toxunmur' },
  REJECTED: { label: 'Rədd edilib', badge: 'badge--rejected', hint: 'Oxuculara göstərilmir; qaydalar yenidən əlavə etməyəcək' },
};

/** Authorized admin request; an expired session goes back to the login page */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...init.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    window.location.href = '/admin/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(Array.isArray(body?.message) ? body.message.join(', ') : body?.message ?? `Xəta ${res.status}`);
  }
  return res.json();
}

/** Put tags on a work (as an editor) or take them off (rules won't re-add them) */
export function setWorkTags(workId: string, change: { add?: string[]; remove?: string[] }) {
  return adminFetch<{ source: TagSource; tag: { slug: string } }[]>(`/works/${workId}/tags`, {
    method: 'PATCH',
    body: JSON.stringify(change),
  });
}
