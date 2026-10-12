/**
 * Readable filter URLs, culture.ru-style: /az/works/muellif-fuzuli/forma-qezel instead of
 * /az/works?authorSlug=fuzuli&form=GHAZAL. The words are Azerbaijani (ASCII-folded, like
 * work slugs) in every UI language. They are public URLs: never rename a value in place.
 *
 * next.config.ts rewrites these paths onto the index pages as `?f=<segment>` params;
 * middleware.ts 308-redirects the old query-string URLs here. The API keeps the reserved
 * words below out of new slugs (apps/api/src/common/utils/slug.ts).
 */

export const GENRE_SLUGS: Record<string, string> = {
  POEM: 'seir',
  PROSE: 'nesr',
  PLAY: 'dram',
  ESSAY: 'esse',
  PHILOSOPHY: 'felsefe',
  LETTER: 'mektub',
  MEMOIR: 'xatire',
};

export const FORM_SLUGS: Record<string, string> = {
  GHAZAL: 'qezel',
  MASNAVI: 'mesnevi',
  RUBAI: 'rubai',
  QASIDA: 'qeside',
  MURABBA: 'murebbe',
  FREE_VERSE: 'serbest',
  OTHER: 'diger',
};

/** Author types are bare words: /az/authors/sairler */
export const AUTHOR_TYPE_SLUGS: Record<string, string> = {
  POET: 'sairler',
  WRITER: 'yazicilar',
  PHILOSOPHER: 'filosoflar',
  PLAYWRIGHT: 'dramaturqlar',
};

const PREFIX = { author: 'muellif-', genre: 'janr-', form: 'forma-', century: 'esr-' } as const;

const invert = (map: Record<string, string>) => Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
const GENRE_BY_SLUG = invert(GENRE_SLUGS);
const FORM_BY_SLUG = invert(FORM_SLUGS);
const TYPE_BY_SLUG = invert(AUTHOR_TYPE_SLUGS);

/** Path-to-regexp patterns for next.config rewrites and the middleware */
export const WORK_FACET_PATTERN = '(?:muellif|janr|forma)-[a-z0-9-]+';
export const AUTHOR_FACET_PATTERN = `(?:${Object.values(AUTHOR_TYPE_SLUGS).join('|')}|esr-\\d{1,2})`;
export const TAG_FACET_PATTERN = 'muellif-[a-z0-9-]+';

export interface WorkFilters {
  author?: string;
  genre?: string;
  form?: string;
}

export interface AuthorFilters {
  type?: string;
  century?: number;
}

/** Keep the query params a facet path does not carry (page, lang, letter…) */
function withQuery(path: string, query?: Record<string, string | number | undefined>) {
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === '' || (k === 'page' && Number(v) <= 1)) continue;
    qp.set(k, String(v));
  }
  return qp.size ? `${path}?${qp}` : path;
}

/** Canonical order: author, genre, form */
export function worksPath(locale: string, f: WorkFilters = {}, query?: Record<string, string | number | undefined>) {
  const segments = [
    f.author && `${PREFIX.author}${f.author}`,
    f.genre && GENRE_SLUGS[f.genre] && `${PREFIX.genre}${GENRE_SLUGS[f.genre]}`,
    f.form && FORM_SLUGS[f.form] && `${PREFIX.form}${FORM_SLUGS[f.form]}`,
  ].filter(Boolean);
  return withQuery(`/${locale}/works${segments.map((s) => `/${s}`).join('')}`, query);
}

/** Canonical order: type, century */
export function authorsPath(locale: string, f: AuthorFilters = {}, query?: Record<string, string | number | undefined>) {
  const segments = [
    f.type && AUTHOR_TYPE_SLUGS[f.type],
    f.century && `${PREFIX.century}${f.century}`,
  ].filter(Boolean);
  return withQuery(`/${locale}/authors${segments.map((s) => `/${s}`).join('')}`, query);
}

export function tagPath(locale: string, tag: string, author?: string, query?: Record<string, string | number | undefined>) {
  return withQuery(`/${locale}/tags/${tag}${author ? `/${PREFIX.author}${author}` : ''}`, query);
}

/** What the `f` params of a rewritten request ask for; `invalid` means the URL should 404 */
interface Parsed<T> {
  filters: T;
  invalid: boolean;
  /** The segments as given, to compare with the canonical path */
  given: string[];
}

function segmentsOf(f: string | string[] | undefined) {
  return f === undefined ? [] : Array.isArray(f) ? f : [f];
}

export function parseWorkFacets(f: string | string[] | undefined): Parsed<WorkFilters> {
  const given = segmentsOf(f);
  const filters: WorkFilters = {};
  let invalid = false;
  for (const seg of given) {
    if (seg.startsWith(PREFIX.author) && !filters.author) filters.author = seg.slice(PREFIX.author.length);
    else if (seg.startsWith(PREFIX.genre) && !filters.genre && GENRE_BY_SLUG[seg.slice(PREFIX.genre.length)])
      filters.genre = GENRE_BY_SLUG[seg.slice(PREFIX.genre.length)];
    else if (seg.startsWith(PREFIX.form) && !filters.form && FORM_BY_SLUG[seg.slice(PREFIX.form.length)])
      filters.form = FORM_BY_SLUG[seg.slice(PREFIX.form.length)];
    else invalid = true; // unknown value, or the same facet twice
  }
  return { filters, invalid, given };
}

export function parseAuthorFacets(f: string | string[] | undefined): Parsed<AuthorFilters> {
  const given = segmentsOf(f);
  const filters: AuthorFilters = {};
  let invalid = false;
  for (const seg of given) {
    if (TYPE_BY_SLUG[seg] && !filters.type) filters.type = TYPE_BY_SLUG[seg];
    else if (seg.startsWith(PREFIX.century) && !filters.century && /^\d{1,2}$/.test(seg.slice(PREFIX.century.length)))
      filters.century = Number(seg.slice(PREFIX.century.length));
    else invalid = true;
  }
  return { filters, invalid, given };
}

export function parseTagFacet(f: string | string[] | undefined): Parsed<{ author?: string }> {
  const given = segmentsOf(f);
  const [seg, ...rest] = given;
  if (!seg) return { filters: {}, invalid: false, given };
  const ok = seg.startsWith(PREFIX.author) && rest.length === 0;
  return { filters: ok ? { author: seg.slice(PREFIX.author.length) } : {}, invalid: !ok, given };
}

/**
 * Old query-string URL → its readable path, or null when the URL carries no old filter params.
 * Unknown params (page, lang, letter…) are kept as query.
 */
export function legacyRedirect(pathname: string, search: URLSearchParams): string | null {
  const match = pathname.match(/^\/([a-z]{2})\/(works|authors|tags\/[^/]+)$/);
  if (!match) return null;
  const [, locale, section] = match;
  const rest = Object.fromEntries([...search.entries()]);
  const take = (key: string) => {
    const v = rest[key];
    delete rest[key];
    return v;
  };

  // A raw ?f= (only rewrites should produce it) goes to the path it stands for
  if (search.has('f')) {
    const f = search.getAll('f');
    delete rest.f;
    if (section === 'works') {
      const { filters, invalid } = parseWorkFacets(f);
      return invalid ? null : worksPath(locale, filters, rest);
    }
    if (section === 'authors') {
      const { filters, invalid } = parseAuthorFacets(f);
      return invalid ? null : authorsPath(locale, filters, rest);
    }
    const { filters, invalid } = parseTagFacet(f);
    return invalid ? null : tagPath(locale, section.slice('tags/'.length), filters.author, rest);
  }

  if (section === 'works') {
    if (!['authorSlug', 'genre', 'form'].some((k) => search.has(k))) return null;
    const author = take('authorSlug');
    const genre = take('genre');
    const form = take('form');
    if ((genre && !GENRE_SLUGS[genre]) || (form && !FORM_SLUGS[form])) return null;
    return worksPath(locale, { author, genre, form }, rest);
  }
  if (section === 'authors') {
    if (!['type', 'century'].some((k) => search.has(k))) return null;
    const type = take('type');
    const century = take('century');
    if ((type && !AUTHOR_TYPE_SLUGS[type]) || (century && !/^\d{1,2}$/.test(century))) return null;
    return authorsPath(locale, { type, century: century ? Number(century) : undefined }, rest);
  }
  if (!search.has('author')) return null;
  const author = take('author');
  return tagPath(locale, section.slice('tags/'.length), author, rest);
}

export type FacetCheck =
  | { kind: 'ok'; locale: string; author?: string }
  | { kind: 'redirect'; to: string }
  | { kind: 'invalid'; locale: string }
  | null;

const WORK_FACET = new RegExp(`^${WORK_FACET_PATTERN}$`);
const AUTHOR_FACET = new RegExp(`^${AUTHOR_FACET_PATTERN}$`);
const TAG_FACET = new RegExp(`^${TAG_FACET_PATTERN}$`);

/**
 * For middleware: is this a filter path, and is it the canonical one? Decided before the
 * page streams, so a wrong order gets a real 308 and an unknown value a real 404.
 * Null for anything that is not a filter path (a work, an author, an unknown route).
 */
export function checkFacetPath(pathname: string): FacetCheck {
  const index = pathname.match(/^\/([a-z]{2})\/(works|authors)\/(.+)$/);
  if (index) {
    const [, locale, section, rest] = index;
    const segments = rest.split('/');
    const matcher = section === 'works' ? WORK_FACET : AUTHOR_FACET;
    if (!segments.every((s) => matcher.test(s))) return null;
    if (section === 'works') {
      const { filters, invalid } = parseWorkFacets(segments);
      if (invalid) return { kind: 'invalid', locale };
      const canonical = worksPath(locale, filters);
      return canonical === pathname ? { kind: 'ok', locale, author: filters.author } : { kind: 'redirect', to: canonical };
    }
    const { filters, invalid } = parseAuthorFacets(segments);
    if (invalid) return { kind: 'invalid', locale };
    const canonical = authorsPath(locale, filters);
    return canonical === pathname ? { kind: 'ok', locale } : { kind: 'redirect', to: canonical };
  }

  const tag = pathname.match(/^\/([a-z]{2})\/tags\/[^/]+\/(.+)$/);
  if (!tag) return null;
  const [, locale, rest] = tag;
  const segments = rest.split('/');
  if (!segments.some((s) => TAG_FACET.test(s))) return null;
  const { filters, invalid } = parseTagFacet(segments);
  return invalid ? { kind: 'invalid', locale } : { kind: 'ok', locale, author: filters.author };
}
