const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

interface FetchOptions extends RequestInit {
  token?: string;
}

async function fetcher<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...init } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...init.headers,
  };

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `API error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Authors
  getAuthors: (params?: URLSearchParams) =>
    fetcher(`/authors${params ? `?${params}` : ''}`),
  getAuthor: (slug: string) => fetcher(`/authors/${slug}`),
  getFeaturedAuthor: () => fetcher('/authors/featured'),

  // Collections
  getCollection: (slug: string) => fetcher(`/collections/${slug}`),

  // Works
  getWorks: (params?: URLSearchParams) =>
    fetcher(`/works${params ? `?${params}` : ''}`),
  getWork: (slug: string) => fetcher(`/works/${slug}`),
  getWorkNav: (slug: string) =>
    fetcher<{ prev: NavItem | null; next: NavItem | null }>(`/works/${slug}/nav`),

  // Translations
  getTranslations: (workId: string) => fetcher(`/translations/work/${workId}`),

  // Search
  search: (params: URLSearchParams) => fetcher(`/search?${params}`),

  // Blog
  getBlogPosts: (params?: URLSearchParams) =>
    fetcher(`/blog${params ? `?${params}` : ''}`),
  getBlogPost: (slug: string) => fetcher(`/blog/${slug}`),

  // Auth
  login: (data: { email: string; password: string }) =>
    fetcher('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: { email: string; username: string; password: string; name?: string }) =>
    fetcher('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
};

interface NavItem {
  slug: string;
  titleAz: string;
  titleRu: string | null;
}
