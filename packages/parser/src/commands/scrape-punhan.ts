import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthorConfig, Genre } from '../types';
import { cachedGet } from '../utils/http';
import { fetchPdfPages, titleCase } from '../scrapers/book-pdf';
import { shortSlug } from '../scrapers/wikisource-az';
import { writeCollectionMd, writeWorkMd } from '../writers/md-writer';

const DATA_DIR = path.resolve(__dirname, '../../data');
const AUTHOR = 'punhan';

/**
 * Baba Pünhan's own site (punhan.azerall.info, 2005–2006, run by his family), kept by the Wayback
 * Machine: his three books, «Acı həqiqət» (2000), «Yalan çeyniyə-çeyniyə» (2000) and «Mən nə dedim
 * ki?!» (2002), one page per ~24 poems, each poem under an <a name="zN"> heading
 */
const SITE = 'http://punhan.azerall.info:80/ts_gen/azl/kitab';
const PAGES: { page: string; at: string }[] = [
  { page: 'aci-2', at: '20060616033742' },
  { page: 'aci-3', at: '20060616103106' },
  { page: 'aci-4', at: '20060616103030' },
  { page: 'aci-5', at: '20060616103043' },
  { page: 'aci-6', at: '20060616103143' },
  { page: 'aci-7', at: '20060616102925' },
  { page: 'aci-8', at: '20060616103016' },
  { page: 'aci-9', at: '20060616103055' },
  { page: 'yalan-2', at: '20060616185422' },
  { page: 'yalan-3', at: '20060620145148' },
  { page: 'dedim-2', at: '20060613085140' },
  { page: 'dedim-3', at: '20060615210055' },
  { page: 'dedim-4', at: '20060615210325' },
];

interface Coll { slug: string; titleAz: string; genre: Genre; year?: number }
const BOOKS: Record<string, Coll> = {
  aci: { slug: 'punhan-aci-heqiqet', titleAz: 'Acı həqiqət', genre: 'POEM', year: 2000 },
  yalan: { slug: 'punhan-yalan-ceyniye-ceyniye', titleAz: 'Yalan çeyniyə-çeyniyə', genre: 'POEM', year: 2000 },
  dedim: { slug: 'punhan-men-ne-dedim-ki', titleAz: 'Mən nə dedim ki?!', genre: 'POEM', year: 2002 },
};
/** The site's section headings inside a book; «ŞERLƏRİ» is the book itself */
const SECTIONS: Record<string, Coll> = {
  'MÜXTƏLİF ŞERLƏR': { slug: 'punhan-muxtelif-seirler', titleAz: 'Müxtəlif şeirlər', genre: 'POEM' },
  FELYETONLAR: { slug: 'punhan-felyetonlar', titleAz: 'Felyetonlar', genre: 'PROSE' },
  'HƏR NƏ GƏLDİ...': { slug: 'punhan-her-ne-geldi', titleAz: 'Hər nə gəldi...', genre: 'PROSE' },
};
const COLLECTION_ORDER = [
  'punhan-aci-heqiqet', 'punhan-muxtelif-seirler', 'punhan-felyetonlar',
  'punhan-yalan-ceyniye-ceyniye', 'punhan-her-ne-geldi', 'punhan-men-ne-dedim-ki',
];

/**
 * Two early poems that are not on the site, from the publisher's preview of the family's
 * «Seçmə şeirlər» (Qanun, 2023): printed page numbers, couplets or quatrains
 */
const QANUN = 'https://www.qanun.az/images/news/2024-01-31-13-26-491706693209.pdf';
const QANUN_POEMS = [
  { pages: [16, 17], stanza: 4 },
  { pages: [19], stanza: 2 },
];

/** Names kept capitalised when an all-caps heading is lowered */
const NAMES = ['qarabağ', 'bakı', 'baba', 'pünhan', 'kərəm', 'avropa'];
/** Headings the site mistyped */
const TITLES: Record<string, string> = {
  '«Mamlı-matan göstərərəm': '«Mamlı-matan» göstərərəm',
  '«CIDIR DÜZÜ» OLMASIN ÇADIR DÜZÜ OLSUN': '«Cıdır düzü» olmasın Çadır düzü olsun',
};

const DATE = /^[\dZ]{1,2} \p{L}+,? \d{4}/u;

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;| /g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** A FrontPage paragraph as text: source line wraps are spaces, <br> breaks a line */
function text(html: string) {
  return decode(html.replace(/\s+/g, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .split('\n')
    .map((l) => l.replace(/ {2,}/g, ' ').trim()
      // Footnote marks whose notes the site left out ("İmama*", "2002*")
      .replace(/([\p{L}\d.,])\*+/gu, '$1')
      // A dialogue dash, not a list item
      .replace(/^-\s*(?=\S)/, '– ')
      .replace(/^\*{3}$/, '* * *'))
    .join('\n')
    .trim();
}

const heading = (t: string) => {
  const fixed = TITLES[t] ?? t;
  if (/\p{Ll}/u.test(fixed)) return fixed;
  return titleCase(fixed, NAMES).replace(/([!?] )(\p{Ll})/gu, (_, p, c) => p + c.toLocaleUpperCase('az'));
};

interface Piece { coll: Coll; sourceId: string; title: string; body: string; year?: number; note: string }

function parsePage(html: string, page: string, at: string): Piece[] {
  const book = BOOKS[page.split('-')[0]];
  // The text is a document of its own inside the layout table; the sidebar after it repeats a poem
  const start = html.indexOf('<a name="z1"');
  const content = html.slice(0, html.indexOf('</html>', start));
  const pieces: Piece[] = [];
  let coll = book;
  let cur: { anchor: string; title: string; paras: string[]; date?: string } | undefined;
  const flush = () => {
    if (!cur) return;
    let date = cur.date;
    // Some dates sit at the end of the last stanza
    const last = cur.paras[cur.paras.length - 1]?.split('\n') ?? [];
    if (!date && DATE.test(last[last.length - 1] ?? '')) {
      date = last.pop();
      cur.paras[cur.paras.length - 1] = last.join('\n');
    }
    date = date?.replace(/\.$/, '');
    const body = [...cur.paras.filter(Boolean), ...(date ? [`*${date}*`] : [])].join('\n\n');
    const year = date?.match(/\b(19\d\d|20\d\d)\b/);
    pieces.push({
      coll, sourceId: `azerall-${page}-${cur.anchor}`, title: heading(cur.title), body,
      year: year ? Number(year[1]) : undefined, note: `https://web.archive.org/web/${at}/${SITE}/${page}.htm#${cur.anchor}`,
    });
    cur = undefined;
  };
  // Section headings (a table cell over table_heard1.gif) and paragraphs, in document order
  // A paragraph never spans another one: the layout leaves some <p> unclosed
  const re = /table_heard1\.gif[^>]*>([\s\S]*?)<\/td>|<p\b([^>]*)>((?:(?!<p\b|table_heard1)[\s\S])*?)<\/p>/gi;
  for (let m; (m = re.exec(content)); ) {
    if (m[1] !== undefined) {
      const name = text(m[1]);
      flush();
      coll = SECTIONS[name] ?? book;
      continue;
    }
    const [, attrs, inner] = [m[0], m[2], m[3]];
    const anchor = inner.match(/<a name="(z\d+)"[^>]*>([\s\S]*?)<\/a>/);
    if (anchor) {
      flush();
      cur = { anchor: anchor[1], title: text(anchor[2]), paras: [] };
      continue;
    }
    if (!cur) continue;
    const t = text(inner);
    if (!t || SECTIONS[t]) continue;
    if (/align="right"/.test(attrs)) cur.date = t;
    else cur.paras.push(t);
  }
  flush();
  return pieces;
}

async function qanunPieces(): Promise<Piece[]> {
  const pages = await fetchPdfPages(QANUN);
  const coll = SECTIONS['MÜXTƏLİF ŞERLƏR'];
  return QANUN_POEMS.map(({ pages: nums, stanza }) => {
    // Each page opens with its printed number
    const lines = nums.flatMap((n) => pages[n - 1].split('\n').map((l) => l.trim()).filter(Boolean).slice(1));
    const [title, ...rest] = lines;
    const date = rest.pop()!;
    const stanzas: string[] = [];
    for (let i = 0; i < rest.length; i += stanza) stanzas.push(rest.slice(i, i + stanza).join('\n'));
    return {
      coll, sourceId: `qanun-2023-p${nums[0]}`, title, body: [...stanzas, `*${date}*`].join('\n\n'),
      year: Number(date.match(/\d{4}/)![0]), note: `${QANUN}#page=${nums[0]}`,
    };
  });
}

export const scrapePunhanCommand = new Command('scrape-punhan')
  .description("Baba Pünhan's three books from his archived site, plus two poems from the Qanun 2023 preview")
  .option('--dry-run', 'Print the plan without writing files')
  .action(async (opts: { dryRun?: boolean }) => {
    const cfg = (JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config/authors.json'), 'utf-8')) as AuthorConfig[])
      .find((a) => a.slug === AUTHOR);
    if (!cfg) {
      console.error(`No "${AUTHOR}" entry in authors.json`);
      process.exit(1);
    }
    const skip = new Set(cfg.skipSources ?? []);
    const pieces: Piece[] = [];
    for (const { page, at } of PAGES) {
      pieces.push(...parsePage(await cachedGet(`https://web.archive.org/web/${at}id_/${SITE}/${page}.htm`), page, at));
    }
    pieces.push(...(await qanunPieces()));

    const used = new Set<string>();
    const counts = new Map<string, number>();
    for (const slug of COLLECTION_ORDER) {
      const c = [...Object.values(BOOKS), ...Object.values(SECTIONS)].find((x) => x.slug === slug)!;
      console.log(`  ${c.slug}  ${c.titleAz}`);
      if (!opts.dryRun) writeCollectionMd({
        slug: c.slug, titleAz: c.titleAz, authorSlug: AUTHOR, genre: c.genre, year: c.year,
        originalLang: 'AZ_LATIN', order: COLLECTION_ORDER.indexOf(slug) + 1, status: 'DRAFT',
      });
    }
    for (const p of pieces) {
      if (skip.has(p.sourceId)) {
        console.log(`    skip ${p.sourceId}  ${p.title}`);
        continue;
      }
      let slug = shortSlug(`${AUTHOR}-${p.title}`);
      for (let n = 2; used.has(slug); n++) slug = `${shortSlug(`${AUTHOR}-${p.title}`)}-${n}`;
      used.add(slug);
      const order = (counts.get(p.coll.slug) ?? 0) + 1;
      counts.set(p.coll.slug, order);
      console.log(`    ${p.sourceId.padEnd(22)} ${slug}  (${p.body.length} chars)`);
      if (!opts.dryRun) writeWorkMd({
        slug, sourceId: p.sourceId, titleAz: p.title, authorSlug: AUTHOR, collectionSlug: p.coll.slug,
        originalLang: 'AZ_LATIN', scriptDirection: 'LTR', genre: p.coll.genre, year: p.year, order,
        sourceNote: p.note, status: 'DRAFT',
      }, p.body);
    }
    console.log(`  ${[...counts.values()].reduce((a, b) => a + b, 0)} works`);
  });
