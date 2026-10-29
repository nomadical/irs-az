import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthorConfig, Genre } from '../types';
import { planWikisourceAz, type PlannedWork } from '../scrapers/wikisource-az';
import { mediawikiApi } from '../utils/http';
import { wikitextToMarkdown, detectScript } from '../utils/wikitext';
import { writeCollectionMd, writeWorkMd } from '../writers/md-writer';

const DATA_DIR = path.resolve(__dirname, '../../data');
const AUTHOR = 'xalq';
const SITE = 'az.wikisource.org';

/**
 * Anonymous folk literature under one author ("Xalq ədəbiyyatı"). The `Müəllif:` pages of
 * Koroğlu and Molla Nəsrəddin go through the az.wikisource planner (their dates stay off the
 * author: a folk author has none); Kitabi-Dədə Qorqud is a book page with a subpage per boy.
 */
interface Source {
  page: string; // Müəllif: page name
  collection: { slug: string; titleAz: string; titleRu: string; titleEn: string; genre: Genre };
}
const SOURCES: Source[] = [
  {
    page: 'Koroğlu',
    collection: { slug: 'xalq-koroglu', titleAz: 'Koroğlu', titleRu: 'Короглу', titleEn: 'Koroghlu', genre: 'POEM' },
  },
  {
    page: 'Molla Nəsrəddin',
    collection: {
      slug: 'xalq-molla-nesreddin-letifeleri',
      titleAz: 'Molla Nəsrəddin lətifələri',
      titleRu: 'Анекдоты о Моле Насреддине',
      titleEn: 'Molla Nasreddin anecdotes',
      genre: 'PROSE',
    },
  },
];

/** The dastan's chapters (subpages of "Koroğlu dastanı", plus the Abdul xoca episode) are prose, not poems */
const DASTAN = {
  slug: 'xalq-koroglu-dastani',
  titleAz: 'Koroğlu dastanı',
  titleRu: 'Дастан «Короглу»',
  titleEn: 'The Epic of Koroghlu',
  genre: 'PROSE' as Genre,
};

const QORQUD = {
  page: 'Kitabi-Dədə Qorqud',
  slug: 'xalq-kitabi-dede-qorqud',
  titleAz: 'Kitabi-Dədə Qorqud',
  titleRu: 'Книга моего деда Коркута',
  titleEn: 'The Book of Dede Korkut',
};

interface ApiResponse {
  query?: { pages?: { title: string; pageid?: number; missing?: boolean; revisions?: { slots: { main: { content: string } } }[] }[] };
}

async function getPage(title: string) {
  const data = await mediawikiApi<ApiResponse>(SITE, {
    action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1', titles: title,
  });
  const p = data.query?.pages?.[0];
  const content = p?.revisions?.[0]?.slots.main.content;
  if (!p || p.missing || content == null) throw new Error(`Page not found: ${title}`);
  return { title: p.title, pageid: p.pageid!, wikitext: content };
}

/** Plain text of a prose page: header template and categories stripped */
function proseText(wikitext: string): string {
  let t = wikitext;
  // drop the {{Başlıq}} header (nested-safe enough: it ends at the first line starting "}}")
  t = t.replace(/\{\{\s*Başlıq[\s\S]*?\n\}\}/i, '');
  t = t.replace(/\{\{[^{}]*\}\}/g, '');
  t = t.replace(/\[\[(Kateqoriya|Category):[^\]]*\]\]/gi, '');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.split('\n').map((l) => l.trim().replace(/^:+\s*/, '')).join('\n');
  let md = wikitextToMarkdown(t);
  md = md.replace(/&nbsp;/g, ' ').replace(/'{2,}/g, '').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

/**
 * The Qorqud pages keep the printed edition's apparatus: Dresden-manuscript page marks ("D67"),
 * the manuscript's line numbers (1–13, set between words or inside them), the printed page
 * number at the end, and words broken at a line end ("ye- rin"). Only that is removed.
 */
function cleanQorqud(text: string): string {
  return text
    .replace(/\bD\d{1,3}\b/g, ' ')
    .replace(/(?<!\*)-[ \t]*\*[ \t]*(?!\*)/g, '-')
    .replace(/(?<!\*)\*(?!\*)/g, ' ') // the edition's footnote asterisks (the notes themselves are not on the page)
    .replace(/(?<=\p{L})-[ \t]+(?=\p{Ll})/gu, '') // word broken at the line end
    .replace(/\d{1,3}/g, '\u0001') // every remaining number is a line number or page number
    .replace(/-(?:[ \t]*\u0001)+[ \t]*/g, '-') // "sara-4sara", "oğlı- 12 qızı": a repeated or paired word
    .replace(/[ \t]*\u0001[ \t]*/g, (m, off: number, all: string) =>
      /\p{L}/u.test(all[off - 1] ?? '') && /\p{L}/u.test(all[off + m.length] ?? '') && !/\s/.test(m) ? '' : ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,;:!?”])/g, '$1')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}

export const scrapeFolkCommand = new Command('scrape-folk')
  .description('Scrape the folk-literature collections (author xalq) from az.wikisource')
  .option('--dry-run', 'plan only')
  .action(async (opts: { dryRun?: boolean }) => {
    const works: (PlannedWork & { genre: Genre })[] = [];
    const collections: { slug: string; titleAz: string; titleRu?: string; titleEn?: string; genre: Genre; order: number }[] = [];

    for (const src of SOURCES) {
      const cfg: AuthorConfig = {
        slug: AUTHOR,
        nameAz: 'Xalq ədəbiyyatı',
        type: 'POET',
        writingLangs: ['AZ_LATIN'],
        wikisource: { az: src.page, az_aliases: ['Xalq', 'Xalq ədəbiyyatı', 'Xalq yaradıcılığı'] },
      };
      const plan = await planWikisourceAz(cfg);
      console.log(`${src.page}: ${plan.works.length} works; skipped ${plan.skipped.length}`);
      for (const s of plan.skipped) console.log(`   skip ${s.reason}: ${s.title}${s.detail ? ` — ${s.detail}` : ''}`);
      const c = src.collection;
      collections.push({ ...c, order: collections.length + 1 });
      // Everything goes in the one collection, in the order the page lists it
      const isDastan = (w: PlannedWork) => /Koroğlu dastanı|Abdul xoca/i.test(decodeURIComponent(w.sourceNote));
      const own = plan.works.filter((w) => !isDastan(w));
      // Poems with the same title (several "Gərək", "Ola") are told apart by their first line
      const count = new Map<string, number>();
      for (const w of own) count.set(w.titleAz, (count.get(w.titleAz) ?? 0) + 1);
      own.forEach((w, i) => {
        const first = w.body.split('\n')[0].replace(/[.,;:!?…]+$/, '');
        works.push({
          ...w, titleAz: (count.get(w.titleAz) ?? 0) > 1 && c.genre === 'POEM' ? first : w.titleAz,
          collectionSlug: c.slug, genre: c.genre, order: i + 1, form: undefined,
        });
      });
      const chapters = plan.works.filter(isDastan);
      if (chapters.length) {
        collections.push({ ...DASTAN, order: collections.length + 1 });
        chapters.forEach((w, i) => works.push({ ...w, collectionSlug: DASTAN.slug, genre: 'PROSE', order: i + 1, form: undefined }));
      }
    }

    // Kitabi-Dədə Qorqud: the müqəddimə and the twelve boys, in the book's order
    const book = await getPage(QORQUD.page);
    const links = [...book.wikitext.matchAll(/^\*\s*\[\[\/([^\]|]+)\|([^\]]+)\]\]/gm)];
    collections.push({ slug: QORQUD.slug, titleAz: QORQUD.titleAz, titleRu: QORQUD.titleRu, titleEn: QORQUD.titleEn, genre: 'PROSE', order: collections.length + 1 });
    let n = 0;
    for (const m of links) {
      const page = await getPage(`${QORQUD.page}/${m[1].trim()}`);
      const body = cleanQorqud(proseText(page.wikitext));
      const header = page.wikitext.match(/\|\s*başlıq\s*=\s*(.+)/i)?.[1]?.trim();
      const isIntro = n === 0;
      const titleAz = isIntro ? 'Müqəddimə' : m[2].trim().replace(/,?\s*xanım,?\s*hey[-!hey]*!?$/i, '').trim();
      n++;
      console.log(`  Qorqud ${n}: ${titleAz} (${body.length} chars) [header: ${header ?? '-'}]`);
      works.push({
        slug: isIntro ? 'xalq-kitabi-dede-qorqud-muqeddime' : `xalq-kitabi-dede-qorqud-boy-${n - 1}`,
        sourceId: `wikisource-az-${page.pageid}`,
        titleAz,
        collectionSlug: QORQUD.slug,
        genre: 'PROSE',
        order: n,
        scriptDirection: detectScript(body),
        sourceNote: `https://${SITE}/wiki/${encodeURIComponent(page.title)}`,
        body,
      } as PlannedWork & { genre: Genre });
    }

    console.log(`Total ${works.length} works in ${collections.length} collections`);
    if (opts.dryRun) {
      fs.writeFileSync(process.env.FOLK_DUMP ?? '/dev/null', JSON.stringify({ collections, works }, null, 1));
      return;
    }

    for (const c of collections) {
      if (fs.existsSync(path.join(DATA_DIR, 'collections', AUTHOR, `${c.slug}.md`))) continue;
      writeCollectionMd({
        slug: c.slug, titleAz: c.titleAz, titleRu: c.titleRu, titleEn: c.titleEn, authorSlug: AUTHOR,
        genre: c.genre, originalLang: 'AZ_LATIN', order: c.order, status: 'DRAFT',
      });
    }
    for (const w of works) {
      writeWorkMd(
        {
          slug: w.slug, sourceId: w.sourceId, titleAz: w.titleAz, authorSlug: AUTHOR, collectionSlug: w.collectionSlug,
          originalLang: 'AZ_LATIN', scriptDirection: w.scriptDirection, genre: w.genre, form: w.form, order: w.order,
          sourceNote: w.sourceNote, status: 'DRAFT',
        },
        w.body,
      );
    }
    console.log(`Wrote ${works.length} works`);
  });
