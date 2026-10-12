/**
 * Wikimedia Commons — manuscript illustrations from libraries the museum importers don't
 * reach (British Library, Topkapı, Bodleian, Hermitage, BnF, Baku …).
 *
 * Commons files Khamsa folios under one category per manuscript (named after its library
 * and shelfmark) and one per poem ("Seven beauties", "Khosrow and Shirin"). The importer
 * walks the author's root categories and keeps a file only when:
 *   - it is public domain or CC0 (this also drops modern photos, which carry CC BY-SA);
 *   - it isn't a copy of a Met or Walters image (those come from their own importers);
 *   - it is an image dated no later than 1900 — or undated but filed under a named
 *     manuscript, since the bare poem categories also hold stage photos and stamps;
 *   - its name isn't a coin, banknote or stamp.
 * The poem comes from the file's categories, falling back to keywords in its title.
 */
import { cachedGetJson } from '../utils/http';
import type { AuthorConfig } from '../types';
import type { PlannedArtwork } from './met';

const API = 'https://commons.wikimedia.org/w/api.php';
const NOT_ARTWORK = /\b(coin|banknote|manat|stamp|sikk|marka|poçt|postage)\b/i;
const FREE = /^(Public domain|PD\b)|^CC0/i;

interface Member {
  title: string;
}
interface FileInfo {
  pageid: number;
  title: string;
  categories?: { title: string }[];
  imageinfo?: {
    url: string;
    thumburl?: string;
    descriptionurl: string;
    mime: string;
    extmetadata?: Record<string, { value: string }>;
  }[];
}

async function api<T>(params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  return cachedGetJson<T>(`${API}?${qs}`);
}

async function members(category: string, type: 'file' | 'subcat'): Promise<Member[]> {
  const out: Member[] = [];
  let cont: Record<string, string> = {};
  for (;;) {
    const d = await api<{ query: { categorymembers: Member[] }; continue?: Record<string, string> }>({
      action: 'query',
      list: 'categorymembers',
      cmtitle: category,
      cmtype: type,
      cmlimit: '500',
      ...cont,
    });
    out.push(...d.query.categorymembers);
    if (!d.continue) return out;
    cont = d.continue;
  }
}

const text = (html?: string) => (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export interface CommonsArtwork extends PlannedArtwork {
  license: string;
}

export async function planCommonsArtworks(cfg: AuthorConfig): Promise<{ artworks: CommonsArtwork[]; candidates: number; reasons: Record<string, number> }> {
  const commons = cfg.commons!;
  const exclude = new RegExp(commons.exclude ?? '(?!)', 'i');
  const poems = (commons.poems ?? []).map((p) => ({ ...p, re: new RegExp(p.match, 'i') }));
  const poemCategories = new Set(poems.map((p) => `Category:${p.category}`));
  const roots = new Set(commons.roots.map((r) => `Category:${r.category}`));

  // File → the category it was found in, and the collection its root assigns
  const found = new Map<string, { category: string; rootCollection?: string }>();
  const seen = new Set<string>();
  const walk = async (category: string, depth: number, rootCollection?: string) => {
    if (seen.has(category) || exclude.test(category)) return;
    seen.add(category);
    for (const f of await members(category, 'file')) if (!found.has(f.title)) found.set(f.title, { category, rootCollection });
    if (depth > 0) for (const c of await members(category, 'subcat')) await walk(c.title, depth - 1, rootCollection);
  };
  for (const r of commons.roots) await walk(`Category:${r.category}`, r.depth ?? 2, r.collection);

  const reasons: Record<string, number> = {};
  const drop = (why: string) => (reasons[why] = (reasons[why] ?? 0) + 1);
  const artworks: CommonsArtwork[] = [];
  const names = new Set<string>();
  const titles = [...found.keys()];

  for (let i = 0; i < titles.length; i += 50) {
    const d = await api<{ query: { pages: FileInfo[] } }>({
      action: 'query',
      prop: 'imageinfo|categories',
      iiprop: 'url|mime|extmetadata',
      // A standard thumbnail width: Wikimedia pre-renders these, and throttles odd sizes
      iiurlwidth: '960',
      iiextmetadatafilter: 'LicenseShortName|Credit|DateTimeOriginal|ObjectName|Artist',
      clshow: '!hidden',
      cllimit: 'max',
      titles: titles.slice(i, i + 50).join('|'),
    });
    for (const p of d.query.pages) {
      const info = p.imageinfo?.[0];
      const meta = info?.extmetadata ?? {};
      const where = found.get(p.title)!;
      if (!info) { drop('no file info'); continue; }
      if (!/^image\/(jpeg|png|tiff)$/.test(info.mime)) { drop('not a still image'); continue; }
      const licence = text(meta.LicenseShortName?.value);
      if (!FREE.test(licence)) { drop('not public domain / CC0'); continue; }
      if (/metmuseum|thewalters/i.test(meta.Credit?.value ?? '')) { drop('copy of a Met / Walters image'); continue; }
      if (NOT_ARTWORK.test(p.title)) { drop('coin, banknote or stamp'); continue; }

      const date = text(meta.DateTimeOriginal?.value);
      // Years before the work existed are Hijri dates or shelfmarks, not the copy's date
      const years = [...date.matchAll(/\b(1[0-9]{3})\b/g)].map((m) => Number(m[1])).filter((y) => y >= (commons.earliest ?? 0));
      const fromManuscript = !poemCategories.has(where.category) && !roots.has(where.category);
      if (years.length ? Math.min(...years) > 1900 : !fromManuscript) { drop(years.length ? 'after 1900' : 'undated, outside a manuscript'); continue; }

      const name = p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '');
      // The same picture uploaded twice ("… Füzuli" and "… Füzuli2")
      const key = name.replace(/\s*\d+$/, '').toLowerCase();
      if (names.has(key)) { drop('duplicate upload'); continue; }
      names.add(key);
      const cats = (p.categories ?? []).map((c) => c.title);
      const poem =
        poems.find((pm) => cats.includes(`Category:${pm.category}`) || where.category === `Category:${pm.category}`) ??
        poems.find((pm) => pm.re.test(name));
      const objectName = text(meta.ObjectName?.value);

      artworks.push({
        sourceId: `commons-${p.pageid}`,
        title: objectName && objectName.length > 6 ? objectName : name,
        collectionSlug: (poem?.collection || where.rootCollection) || undefined,
        objectDate: date.slice(0, 80) || undefined,
        yearStart: years.length ? Math.min(...years) : undefined,
        yearEnd: years.length ? Math.max(...years) : undefined,
        medium: undefined,
        artists: text(meta.Artist?.value).slice(0, 200) || undefined,
        // The original (possibly a TIFF) is the "Full size" link; galleries show the 960px rendering
        imageUrl: info.url,
        // Commons appends tracking parameters ("?utm_source=…"); one clean URL caches better
        imageSmallUrl: (info.thumburl ?? info.url).replace(/\?.*$/, ''),
        additionalImages: [],
        sourceUrl: info.descriptionurl,
        // The manuscript's category names its library and shelfmark
        creditLine: fromManuscript
          ? where.category.replace(/^Category:/, '')
          : text(meta.Credit?.value).replace(/^\[\d+\]$/, '').slice(0, 200) || undefined,
        license: /^CC0/i.test(licence) ? 'CC0' : 'Public domain',
      });
    }
  }

  artworks.sort((a, b) => (a.yearStart ?? 9999) - (b.yearStart ?? 9999) || a.sourceId.localeCompare(b.sourceId, 'en', { numeric: true }));
  return { artworks, candidates: titles.length, reasons };
}
