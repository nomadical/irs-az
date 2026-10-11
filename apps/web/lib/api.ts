import { notFound } from 'next/navigation';

const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

// Server-side rendering talks to the API over the internal network (API_URL, read at
// runtime); the browser uses the public URL, which may be relative like `/api`.
const API_URL =
  typeof window === 'undefined' ? process.env.API_URL ?? PUBLIC_API_URL : PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** `.catch()` handler for detail pages: a missing entity renders the 404 page instead of a 500. */
export function notFoundOn404(err: unknown): never {
  if (err instanceof ApiError && err.status === 404) notFound();
  throw err;
}

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
    throw new ApiError(body.message ?? `API error: ${res.status}`, res.status);
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

  // Sitemap
  getSitemap: () =>
    fetcher<SitemapEntries>('/sitemap', { next: { revalidate: 3600 } }),

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

interface SitemapEntry {
  slug: string;
  updatedAt: string;
}

interface SitemapEntries {
  authors: SitemapEntry[];
  collections: SitemapEntry[];
  works: SitemapEntry[];
  blog: SitemapEntry[];
}
