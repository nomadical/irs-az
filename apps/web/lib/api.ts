import { notFound, permanentRedirect } from 'next/navigation';

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

/**
 * Work for a reading page. A renamed work's old slug permanently redirects to the
 * new URL; an unknown slug renders the 404 page.
 */
export async function getWorkOrRedirect(slug: string, locale: string, suffix = '') {
  try {
    return await api.getWork(slug);
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) throw err;
    const current = await api.resolveWork(slug).catch(() => null);
    if (current && current.slug !== slug) {
      permanentRedirect(`/${locale}/works/${encodeURIComponent(current.slug)}${suffix}`);
    }
    notFound();
  }
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
  getRandomWork: () => fetcher<{ slug: string }>('/works/random', { cache: 'no-store' }),
  getCatalog: () => fetcher<Catalog>('/works/catalog', { next: { revalidate: 600 } }),
  getPoemOfTheDay: () => fetcher<PoemOfTheDay>('/works/daily', { cache: 'no-store' }),
  resolveWork: (slug: string) => fetcher<{ slug: string }>(`/works/resolve/${slug}`),
  getMoreByAuthor: (slug: string, locale: string) =>
    fetcher<MoreWork[]>(`/works/${slug}/more?locale=${locale}`),
  getOtherPoets: (slug: string, locale: string) =>
    fetcher<{ theme: TagRef | null; works: OtherWork[] }>(`/works/${slug}/others?locale=${locale}`),
  getWorkNav: (slug: string) =>
    fetcher<{ prev: NavItem | null; next: NavItem | null }>(`/works/${slug}/nav`),

  // Tags
  getTags: () => fetcher<TagSummary[]>('/tags'),
  getTag: (slug: string) => fetcher<TagDetail>(`/tags/${slug}`),

  // Translations
  getTranslations: (workId: string) => fetcher(`/translations/work/${workId}`),

  // Search
  search: (params: URLSearchParams) => fetcher(`/search?${params}`),

  // Blog
  getBlogPosts: (params?: URLSearchParams) =>
    fetcher(`/blog${params ? `?${params}` : ''}`),
  getBlogPost: (slug: string) => fetcher(`/blog/${slug}`),

  // Public submissions (anonymous "Contribute" form)
  submitPublic: (data: PublicSubmission) =>
    fetcher<{ ok: true }>('/submissions/public', { method: 'POST', body: JSON.stringify(data) }),

  // Sitemap
  getSitemap: () =>
    fetcher<SitemapEntries>('/sitemap', { next: { revalidate: 3600 } }),

  // Auth
  login: (data: { email: string; password: string }) =>
    fetcher('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: { email: string; username: string; password: string; name?: string }) =>
    fetcher('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
};

/** Published counts behind the homepage catalog */
export interface Catalog {
  works: number;
  forms: Partial<Record<string, number>>;
  genres: Partial<Record<string, number>>;
  authors: Partial<Record<string, number>>;
}

export type TagKind = 'THEME' | 'MOOD' | 'AUDIENCE' | 'ERA';

export interface TagRef {
  slug: string;
  kind: TagKind;
  nameAz: string;
  nameRu: string | null;
  nameEn: string | null;
}

export interface TagSummary extends TagRef {
  works: number;
}

export interface TagDetail extends TagSummary {
  authors: { slug: string; nameAz: string; nameRu: string | null; nameEn: string | null; works: number }[];
}

export interface MoreWork {
  slug: string;
  titleAz: string;
  titleRu: string | null;
  titleEn: string | null;
  genre: string;
  form: string | null;
  year: number | null;
  incipit: { lines: string[]; lang: string };
}

export interface OtherWork extends MoreWork {
  author: { slug: string; nameAz: string; nameRu: string | null; nameEn: string | null };
}

interface NavItem {
  slug: string;
  titleAz: string;
  titleRu: string | null;
}

export interface PoemOfTheDay {
  slug: string;
  titleAz: string;
  titleRu: string | null;
  titleEn: string | null;
  form: string | null;
  year: number | null;
  date: string;
  /** Opening lines, in Azerbaijani */
  excerpt: string[];
  author: { slug: string; nameAz: string; nameRu: string | null; nameEn: string | null };
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

export interface PublicSubmission {
  type: 'WORK' | 'TRANSLATION' | 'AUTHOR';
  payload: Record<string, unknown>;
  contactName: string;
  contactEmail: string;
  sourceNote?: string;
  /** Honeypot */
  website?: string;
}
