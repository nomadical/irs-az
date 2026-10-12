/**
 * Author portraits from Wikidata's image property (P18), stored on Wikimedia Commons.
 *
 * The author is found through their Wikipedia article (az, then ru, then en titles from the
 * config). Commons supplies a standard-width rendering — Wikimedia pre-renders those and
 * throttles odd sizes — and the credit: artist, year and licence, cleaned of the markup
 * Commons wraps them in ("Unknown authorUnknown author", "1930sdate QS:P,+1930…").
 */
import { cachedGetJson } from '../utils/http';
import type { AuthorConfig } from '../types';

const WIKIDATA = 'https://www.wikidata.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
// The author page shows portraits 130px wide; 330px is the nearest standard width above 2×
const WIDTH = '330';

export interface Portrait {
  url: string;
  source: string; // the Commons file page
  credit: string;
  file: string;
  wikidata: string;
}

const text = (html?: string) => (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** "Unknown authorUnknown author" → "Unknown author"; "Naməlum" → "Unknown author" */
function cleanArtist(raw: string): string {
  let a = raw.replace(/^(.+?)\s*\1$/, '$1').trim();
  if (/^(unknown author|naməlum|неизвестный|anonymous)$/i.test(a)) a = 'Unknown author';
  return a.replace(/^Processed by\s+/i, '').slice(0, 80);
}

/** The year from a Commons date ("before 12 July 1911", "1930sdate QS:P,+1930…", "1947-06") */
function cleanYear(raw: string): string {
  const date = raw.split(/date QS:/)[0];
  const decade = date.match(/\b(1[0-9]{2}0)s\b/);
  if (decade) return `${decade[1]}s`;
  const year = date.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return year ? year[1] : '';
}

export interface WikidataItem {
  id: string;
  claims: Record<string, any[]>;
}

async function wikidataItem(site: string, title: string): Promise<WikidataItem | null> {
  const qs = new URLSearchParams({ action: 'wbgetentities', sites: site, titles: title, props: 'claims', format: 'json' });
  const d = await cachedGetJson<{ entities?: Record<string, any> }>(`${WIKIDATA}?${qs}`);
  const e = Object.values(d.entities ?? {})[0];
  if (!e || 'missing' in e || !e.id) return null;
  return { id: e.id, claims: e.claims ?? {} };
}

/** The author's Wikidata item, found through their Wikipedia article */
export async function findWikidataItem(cfg: AuthorConfig): Promise<WikidataItem | null> {
  const wp = cfg.wikipedia ?? {};
  for (const [lang, title] of [['az', wp.az], ['ru', wp.ru], ['en', wp.en]] as const) {
    if (!title) continue;
    const item = await wikidataItem(`${lang}wiki`, title);
    if (item) return item;
  }
  return null;
}

export async function findPortrait(cfg: AuthorConfig): Promise<Portrait | null> {
  const found = await findWikidataItem(cfg);
  const item = found && { id: found.id, image: found.claims.P18?.[0]?.mainsnak?.datavalue?.value as string | undefined };
  if (!item?.image) return null;

  const qs = new URLSearchParams({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: WIDTH,
    iiextmetadatafilter: 'LicenseShortName|Artist|DateTimeOriginal',
    titles: `File:${item.image}`,
    format: 'json',
    formatversion: '2',
  });
  const d = await cachedGetJson<{ query: { pages: { imageinfo?: { url: string; thumburl?: string; descriptionurl: string; extmetadata?: Record<string, { value: string }> }[] }[] } }>(`${COMMONS}?${qs}`);
  const info = d.query.pages[0]?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  const artist = cleanArtist(text(meta.Artist?.value));
  const year = cleanYear(text(meta.DateTimeOriginal?.value));
  const licence = text(meta.LicenseShortName?.value);

  return {
    // Commons appends tracking parameters; one clean URL caches better
    url: (info.thumburl ?? info.url).replace(/\?.*$/, ''),
    source: info.descriptionurl,
    credit: [[artist, year].filter(Boolean).join(', '), licence].filter(Boolean).join(' · '),
    file: item.image,
    wikidata: item.id,
  };
}
