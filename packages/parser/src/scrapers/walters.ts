/**
 * The Walters Art Museum's digitised manuscripts ("The Digital Walters") — miniatures from
 * illustrated manuscripts of the author's works.
 *
 * Each manuscript has a TEI description listing its decorations by folio: a scene title,
 * the poem it illustrates ("text-identifier") and the decoration form. Only illustrations
 * whose poem is one of the author's are kept — some manuscripts bind several poets' works
 * together (W.657 adds Amir Khusraw's quintet, whose "Shīrīn va Khusraw" is not Nizami's).
 * The folio leads to its page image.
 */
import { cachedGet } from '../utils/http';
import type { AuthorConfig } from '../types';
import type { PlannedArtwork } from './met';

const BASE = 'https://thedigitalwalters.org/Data/WaltersManuscripts';

const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
/** Diacritics off for matching: "Laylá va Majnūn" → "layla va majnun" */
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ʻʼʿʾ'’]/g, '').toLowerCase();

function first(xml: string, re: RegExp): string {
  const m = xml.match(re);
  return m ? strip(m[1]) : '';
}

/** "Licensed for use under Creative Commons Attribution-NonCommercial-ShareAlike 3.0 …" → "CC BY-NC-SA 3.0" */
function licenceCode(text: string): string {
  const m = text.match(/Creative Commons ([A-Za-z-]+) (\d\.\d)/);
  if (!m) return text.slice(0, 60);
  const parts: Record<string, string> = { Attribution: 'BY', NonCommercial: 'NC', ShareAlike: 'SA', NoDerivs: 'ND', NoDerivatives: 'ND' };
  return `CC ${m[1].split('-').map((p) => parts[p] ?? p).join('-')} ${m[2]}`;
}

/**
 * Common-era years from a catalogue date: "922 AH / 1516 CE" → 1516; "885-886 / 1481" → 1481;
 * "Mid 10th century AH / 16th CE" → 1500–1599. The Hijri part (before the slash) is ignored.
 */
function yearsFrom(date: string): [number, number] | undefined {
  const ce = date.includes('/') ? date.slice(date.indexOf('/') + 1) : date;
  const years = [...ce.matchAll(/\b(1[0-9]{3})\b/g)].map((m) => Number(m[1]));
  if (years.length) return [Math.min(...years), Math.max(...years)];
  const century = ce.match(/(\d{1,2})(?:st|nd|rd|th)\s+(?:century\s+)?CE/i);
  if (century) {
    const c = Number(century[1]);
    return [(c - 1) * 100, (c - 1) * 100 + 99];
  }
  return undefined;
}

export interface WaltersArtwork extends PlannedArtwork {
  license: string;
}

export async function planWaltersArtworks(cfg: AuthorConfig): Promise<{ artworks: WaltersArtwork[]; skipped: number }> {
  const walters = cfg.walters!;
  const poems = walters.poems.map((p) => ({ re: new RegExp(p.match, 'i'), collection: p.collection }));
  const artworks: WaltersArtwork[] = [];
  let skipped = 0;

  for (const id of walters.manuscripts) {
    const xml = await cachedGet(`${BASE}/ManuscriptDescriptions/${id}_tei.xml`);
    const shelfmark = first(xml, /<idno[^>]*>([^<]+)<\/idno>/) || id.replace(/^W/, 'W.');
    const work = first(xml, /<msItem[^>]*>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/);
    const date = first(xml, /<origDate[^>]*>([\s\S]*?)<\/origDate>/);
    const years = yearsFrom(date);
    const licence = licenceCode(first(xml, /<availability[^>]*>([\s\S]*?)<\/availability>/));

    // Folio → its page image (the display-size "sap" JPEG)
    const images = new Map<string, string>();
    for (const s of xml.matchAll(/<surface[^>]*n="([^"]+)"[^>]*>([\s\S]*?)<\/surface>/g)) {
      const sap = s[2].match(/<graphic url="(sap\/[^"]+)"/);
      if (sap) images.set(s[1], sap[1]);
    }
    const folder = `${BASE}/${id}/data/${shelfmark}`;

    for (const d of xml.matchAll(/<decoNote n="([^"]+)"[^>]*>([\s\S]*?)<\/decoNote>/g)) {
      const [, folio, body] = d;
      if (!/decoration-form"[^>]*>[^<]*Illustration/.test(body)) continue;
      const poem = first(body, /text-identifier"[^>]*>([^<]*)</);
      const rule = poems.find((p) => p.re.test(plain(poem)));
      const image = images.get(folio);
      // Not one of the author's poems, or no page image
      if (!rule || !image) {
        skipped++;
        continue;
      }
      const scene = first(body, /<title[^>]*>([\s\S]*?)<\/title>/);
      artworks.push({
        sourceId: `walters-${id}-${folio.replace(/^fol\.\s*/, '').replace(/\s+/g, '')}`,
        title: `"${scene}", ${folio} from ${work ? `the ${work}, ` : ''}Walters Ms. ${shelfmark}`,
        collectionSlug: rule.collection || undefined,
        objectDate: date || undefined,
        yearStart: years?.[0],
        yearEnd: years?.[1],
        medium: undefined,
        artists: undefined,
        imageUrl: `${folder}/${image}`,
        imageSmallUrl: `${folder}/${image}`,
        additionalImages: [],
        sourceUrl: `${BASE}/html/${id}/description.html`,
        creditLine: `Walters Art Museum, Ms. ${shelfmark}`,
        license: licence,
      });
    }
  }

  artworks.sort((a, b) => (a.yearStart ?? 9999) - (b.yearStart ?? 9999) || a.sourceId.localeCompare(b.sourceId, 'en', { numeric: true }));
  return { artworks, skipped };
}
