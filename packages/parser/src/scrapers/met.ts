/**
 * The Met Open Access importer — public-domain manuscript pages and miniatures.
 *
 * Searches only gather candidates (free text matches "Khaqan" for Khaqani, the painter
 * Isma'il Jalayir for Shah Isma'il). An object is kept only when the Met credits the
 * author as "Author" or "Poet", it is public domain, and it has an image.
 */
import { cachedGetJson } from '../utils/http';
import type { AuthorConfig } from '../types';

const API = 'https://collectionapi.metmuseum.org/public/collection';
const PAGE = 100;
const AUTHOR_ROLES = new Set(['Author', 'Poet']);

/** The Met sits behind Imperva, which answers bursts with a 403 challenge page; back off and retry */
async function metGet<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await cachedGetJson<T>(url);
    } catch (err: any) {
      const status = err?.response?.status;
      if ((status !== 403 && status !== 429) || attempt >= 3) throw err;
      const wait = 20_000 * 2 ** attempt;
      console.warn(`  Met answered ${status}; retrying in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

export interface PlannedArtwork {
  sourceId: string;
  title: string;
  collectionSlug?: string;
  objectDate?: string;
  yearStart?: number;
  yearEnd?: number;
  medium?: string;
  artists?: string;
  imageUrl: string;
  imageSmallUrl?: string;
  additionalImages: string[];
  sourceUrl: string;
  creditLine?: string;
}

interface MetObject {
  objectID: number;
  isPublicDomain: boolean;
  primaryImage: string;
  primaryImageSmall: string;
  additionalImages: string[];
  title: string;
  objectDate: string;
  objectBeginDate: number;
  objectEndDate: number;
  medium: string;
  creditLine: string;
  objectURL: string;
  constituents: { name: string; role: string }[] | null;
}

/** v1.1 search is paginated; collect every matching id */
async function searchIds(q: string): Promise<number[]> {
  const ids: number[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const qs = new URLSearchParams({ q, hasImages: 'true', limit: String(PAGE), offset: String(offset) });
    const data = await metGet<{ total: number; objectIDs: number[] | null }>(`${API}/v1.1/search?${qs}`);
    ids.push(...(data.objectIDs ?? []));
    if (!data.objectIDs?.length || offset + PAGE >= data.total) break;
  }
  return ids;
}

const decode = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ʿʾ'’`]/g, '').toLowerCase();

export async function planMetArtworks(cfg: AuthorConfig): Promise<{ artworks: PlannedArtwork[]; candidates: number }> {
  const met = cfg.met!;
  const names = met.names.map(normalize);
  const rules = (met.collections ?? []).map((r) => ({ re: new RegExp(r.match, 'i'), collection: r.collection }));

  const ids = new Set<number>();
  for (const q of met.queries) for (const id of await searchIds(q)) ids.add(id);

  const artworks: PlannedArtwork[] = [];
  for (const id of ids) {
    let o: MetObject;
    try {
      o = await metGet<MetObject>(`${API}/v1/objects/${id}`);
    } catch (err: any) {
      if (err?.response?.status === 404) continue; // withdrawn objects
      throw err;
    }
    if (!o.isPublicDomain || !o.primaryImage) continue;

    const people = o.constituents ?? [];
    const byAuthor = people.some((c) => AUTHOR_ROLES.has(c.role) && names.includes(normalize(decode(c.name))));
    if (!byAuthor) continue;

    const title = decode(o.title);
    const artists = people
      .filter((c) => !AUTHOR_ROLES.has(c.role))
      .map((c) => `${decode(c.name).replace(/^Painting by /, '')} (${c.role})`)
      .join(', ');

    artworks.push({
      sourceId: `met-${o.objectID}`,
      title,
      collectionSlug: rules.find((r) => r.re.test(title))?.collection,
      objectDate: o.objectDate || undefined,
      yearStart: o.objectBeginDate || undefined,
      yearEnd: o.objectEndDate || undefined,
      medium: o.medium || undefined,
      artists: artists || undefined,
      imageUrl: o.primaryImage,
      imageSmallUrl: o.primaryImageSmall || undefined,
      additionalImages: o.additionalImages ?? [],
      sourceUrl: o.objectURL,
      creditLine: o.creditLine || undefined,
    });
  }

  // Oldest first, so a collection's gallery reads as a history of the manuscripts
  artworks.sort((a, b) => (a.yearStart ?? 9999) - (b.yearStart ?? 9999) || a.sourceId.localeCompare(b.sourceId));
  return { artworks, candidates: ids.size };
}
