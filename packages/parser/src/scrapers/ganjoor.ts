import { cachedGetJson } from '../utils/http';
import type { PoemForm } from '../types';

interface GanjoorVerse {
  vOrder: number;
  coupletIndex: number;
  versePosition: number; // 0 = first hemistich, 1 = second hemistich
  text: string;
}

interface GanjoorPoemSummary {
  id: number;
  title: string;
  urlSlug: string;
  excerpt: string;
}

interface GanjoorPoemFull {
  id: number;
  title: string;
  fullTitle: string;
  urlSlug: string;
  fullUrl: string;
  plainText: string;
  verses: GanjoorVerse[];
}

interface GanjoorCatResponse {
  cat: {
    id: number;
    title: string;
    urlSlug: string;
    fullUrl: string;
    children: { id: number; title: string; urlSlug: string }[];
    poems: GanjoorPoemSummary[];
  };
}

/** How a collection's verses are laid out; the defaults suit a divan of couplets */
export interface GanjoorLayout {
  /** Stanzas between numbered markers ("۱", "(۲)") instead of couplets: Heydərbabaya salam */
  stanzas?: boolean;
  /** Leave out prose paragraphs (verse position -1), such as a modern translation appended to a poem */
  dropProse?: boolean;
  /** Poems that interleave a translation, line by line, before each line of the original: keep the original */
  interlinear?: number[];
}

export interface GanjoorScrapedWork {
  titleFa: string;
  body: string;
  ganjoorId: number;
  sourceUrl: string;
  order: number;
}

/**
 * Convert Ganjoor verse array to stanza-based Markdown.
 * Each couplet becomes two lines, with blank lines between couplets.
 */
function versesToMarkdown(verses: GanjoorVerse[]): string {
  if (!verses || verses.length === 0) return '';

  // Group by coupletIndex
  const couplets = new Map<number, GanjoorVerse[]>();
  for (const v of verses) {
    const group = couplets.get(v.coupletIndex) ?? [];
    group.push(v);
    couplets.set(v.coupletIndex, group);
  }

  const lines: string[] = [];
  const sortedKeys = [...couplets.keys()].sort((a, b) => a - b);

  for (const key of sortedKeys) {
    const group = couplets.get(key)!;
    group.sort((a, b) => a.versePosition - b.versePosition);

    for (const v of group) {
      lines.push(v.text.trim());
    }
    lines.push(''); // blank line between couplets
  }

  return lines.join('\n').trim();
}

const STANZA_MARKER = /^\(?[۰-۹0-9]+\)?$/;
const BIDI = /[\u200e\u200f\u202a-\u202e]/g;

/** Stanzas between numbered markers; what precedes the first marker is the page's own heading */
function stanzasToMarkdown(verses: GanjoorVerse[], originalOnly: boolean): string | null {
  const ordered = [...verses].sort((a, b) => a.vOrder - b.vOrder);
  if (!ordered.some((v) => STANZA_MARKER.test(v.text.replace(BIDI, '').trim()))) return null;
  const stanzas: string[][] = [];
  for (const v of ordered) {
    const text = v.text.replace(BIDI, '').trim();
    if (!text) continue;
    if (STANZA_MARKER.test(text)) {
      stanzas.push([]);
      continue;
    }
    if (!stanzas.length || (originalOnly && v.versePosition !== 1)) continue;
    stanzas[stanzas.length - 1].push(text);
  }
  return stanzas.filter((s) => s.length).map((s) => s.join('\n')).join('\n\n');
}

function layOut(poem: GanjoorPoemFull, layout: GanjoorLayout): string {
  let verses = poem.verses;
  if (layout.dropProse) verses = verses.filter((v) => v.versePosition !== -1);
  if (layout.stanzas) {
    const md = stanzasToMarkdown(verses, !!layout.interlinear?.includes(poem.id));
    if (md) return md;
  }
  return versesToMarkdown(verses);
}

/**
 * Map Ganjoor category slug patterns to PoemForm enum.
 */
export function mapGanjoorForm(slug: string): PoemForm | undefined {
  const lower = slug.toLowerCase();
  if (lower.includes('ghazal')) return 'GHAZAL';
  if (lower.includes('ghaside') || lower.includes('qasid')) return 'QASIDA';
  if (lower.includes('robaee') || lower.includes('roba')) return 'RUBAI';
  if (lower.includes('masnavi')) return 'MASNAVI';
  if (lower.includes('morabba')) return 'MURABBA';
  return undefined;
}

/** Fetch a single poem with full verses */
async function fetchPoem(poemId: number): Promise<GanjoorPoemFull | null> {
  try {
    return await cachedGetJson<GanjoorPoemFull>(
      `https://api.ganjoor.net/api/ganjoor/poem/${poemId}?verseDetails=true`,
    );
  } catch {
    console.warn(`  Warning: failed to fetch poem ${poemId}`);
    return null;
  }
}

/** Scrape poems from a Ganjoor category (collection) */
export async function scrapeGanjoorCollection(
  catUrl: string,
): Promise<GanjoorScrapedWork[]> {
  // catUrl is a path like "/fozooli/divan/ghazal"
  const urlPath = catUrl.replace(/^https?:\/\/ganjoor\.net/, '');
  const apiUrl = `https://api.ganjoor.net/api/ganjoor/cat?url=${encodeURIComponent(urlPath)}&poems=true`;

  console.log(`  Fetching Ganjoor category: ${urlPath}`);

  let data: GanjoorCatResponse;
  try {
    data = await cachedGetJson<GanjoorCatResponse>(apiUrl);
  } catch (err) {
    console.warn(`  Warning: failed to fetch Ganjoor category: ${urlPath}`);
    return [];
  }

  // Poems are under cat.poems (not top-level) and only have summary data
  const poemSummaries = data.cat?.poems ?? [];
  console.log(`  Found ${poemSummaries.length} poems, fetching full text...`);

  const results: GanjoorScrapedWork[] = [];

  for (let i = 0; i < poemSummaries.length; i++) {
    const summary = poemSummaries[i];
    const full = await fetchPoem(summary.id);

    if (!full || !full.verses || full.verses.length === 0) {
      // Fallback to plainText if no verses
      if (full?.plainText) {
        results.push({
          titleFa: full.title,
          body: full.plainText,
          ganjoorId: full.id,
          sourceUrl: `https://ganjoor.net${full.fullUrl ?? full.urlSlug}`,
          order: i + 1,
        });
      }
      continue;
    }

    results.push({
      titleFa: full.title,
      body: versesToMarkdown(full.verses),
      ganjoorId: full.id,
      sourceUrl: `https://ganjoor.net${full.fullUrl ?? full.urlSlug}`,
      order: i + 1,
    });
  }

  console.log(`  Fetched ${results.length} poems with text`);
  return results;
}

/**
 * Recursively scrape poems from a Ganjoor category and all its subcategories.
 * Needed for authors like Nizami whose Khamsah poems have chapters as subcategories.
 */
export async function scrapeGanjoorCollectionRecursive(
  catUrl: string,
  layout: GanjoorLayout & { flat?: boolean } = {},
): Promise<GanjoorScrapedWork[]> {
  const urlPath = catUrl.replace(/^https?:\/\/ganjoor\.net/, '');
  const apiUrl = `https://api.ganjoor.net/api/ganjoor/cat?url=${encodeURIComponent(urlPath)}&poems=true`;

  console.log(`  Fetching Ganjoor category (recursive): ${urlPath}`);

  let data: GanjoorCatResponse;
  try {
    data = await cachedGetJson<GanjoorCatResponse>(apiUrl);
  } catch {
    console.warn(`  Warning: failed to fetch Ganjoor category: ${urlPath}`);
    return [];
  }

  // Collect poems at this level
  const results: GanjoorScrapedWork[] = [];
  const poemSummaries = data.cat?.poems ?? [];

  if (poemSummaries.length > 0) {
    console.log(`  Found ${poemSummaries.length} poems at ${urlPath}, fetching full text...`);
    for (let i = 0; i < poemSummaries.length; i++) {
      const summary = poemSummaries[i];
      const full = await fetchPoem(summary.id);

      if (!full || !full.verses || full.verses.length === 0) {
        if (full?.plainText) {
          results.push({
            titleFa: full.title,
            body: full.plainText,
            ganjoorId: full.id,
            sourceUrl: `https://ganjoor.net${full.fullUrl ?? full.urlSlug}`,
            order: results.length + 1,
          });
        }
        continue;
      }

      results.push({
        titleFa: full.title,
        body: layOut(full, layout),
        ganjoorId: full.id,
        sourceUrl: `https://ganjoor.net${full.fullUrl ?? full.urlSlug}`,
        order: results.length + 1,
      });
    }
  }

  // Recurse into children, unless the category's own poems are all that's wanted
  const children = layout.flat ? [] : data.cat?.children ?? [];
  for (const child of children) {
    const parentPath = data.cat.fullUrl ?? `/${data.cat.urlSlug}`;
    const childUrl = `${parentPath}/${child.urlSlug}`.replace(/\/+/g, '/');
    const childResults = await scrapeGanjoorCollectionRecursive(`https://ganjoor.net${childUrl}`, layout);
    for (const r of childResults) {
      results.push({ ...r, order: results.length + 1 });
    }
  }

  return results;
}

export interface GanjoorDiscoveredCollection {
  catUrl: string;
  title: string;
  form?: PoemForm;
}

/**
 * Discover collections for a poet by walking one level of children
 * from the poet's root category. Used for authors where we don't know
 * the exact Ganjoor structure upfront.
 */
export async function discoverGanjoorCollections(
  poetSlug: string,
): Promise<GanjoorDiscoveredCollection[]> {
  const urlPath = `/${poetSlug}`;
  const apiUrl = `https://api.ganjoor.net/api/ganjoor/cat?url=${encodeURIComponent(urlPath)}&poems=true`;

  console.log(`  Discovering Ganjoor collections for: ${poetSlug}`);

  let data: GanjoorCatResponse;
  try {
    data = await cachedGetJson<GanjoorCatResponse>(apiUrl);
  } catch {
    console.warn(`  Warning: failed to discover Ganjoor collections for ${poetSlug}`);
    return [];
  }

  const children = data.cat?.children ?? [];
  console.log(`  Found ${children.length} top-level categories`);

  const parentPath = (data.cat.fullUrl ?? `/${data.cat.urlSlug}`).replace(/\/+/g, '/');
  return children.map((child) => ({
    catUrl: `https://ganjoor.net${parentPath}/${child.urlSlug}`,
    title: child.title,
    form: mapGanjoorForm(child.urlSlug),
  }));
}
