/**
 * az.wikisource importer — walks an author's `Müəllif:` page as the table of contents.
 *
 * The author page lists the author's own works under headings ("Qəzəlləri", "Dramları").
 * Each linked page is either a text (→ one work) or an index of further pages
 * (→ its own collection, flattened). Pages *about* the author, translations, and anything
 * not linked from the author page are left out.
 */
import { mediawikiApi } from '../utils/http';
import { wikitextToMarkdown, detectScript } from '../utils/wikitext';
import { slugify } from '../utils/slug';
import type { AuthorConfig, Genre, PoemForm, ScriptDirection } from '../types';

const SITE = 'az.wikisource.org';
const BATCH = 20; // titles per API request — keeps the URL well under Wikimedia's limit
const MAX_DEPTH = 4;
const MIN_TEXT = 80; // shorter than this (after stripping links) is an index, not a text

/**
 * Editors and compilers that az.wikisource enters in the author/translator fields:
 * Araslı transliterated Füzuli's divan from Arabic script, Nəvvab's 19th-century
 * anthology is the source of many Vaqif poems, and Allahyarov and Fərmanov are on the team
 * that edited a modern Vaqif edition. None of them makes a page someone else's work.
 */
const EDITORS = ['Həmid Araslı', 'Mir Möhsün Nəvvab', 'Kamil Allahyarov', 'Fərrux Fərmanov'];

export interface PlannedCollection {
  slug: string;
  titleAz: string;
  genre: Genre;
  year?: number;
  order: number;
}

export interface PlannedWork {
  slug: string;
  sourceId: string;
  titleAz: string;
  collectionSlug: string;
  genre: Genre;
  form?: PoemForm;
  year?: number;
  order: number;
  scriptDirection: ScriptDirection;
  sourceNote: string;
  body: string;
}

export interface SkippedPage {
  title: string;
  reason: 'translation' | 'other-author' | 'missing' | 'empty' | 'skip-list' | 'duplicate';
  detail?: string;
}

export interface WikisourcePlan {
  collections: PlannedCollection[];
  works: PlannedWork[];
  skipped: SkippedPage[];
}

// ── Fetching ──

interface Page {
  pageid: number;
  title: string;
  wikitext: string;
}

interface QueryResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: {
      pageid?: number;
      title: string;
      missing?: boolean;
      revisions?: { slots: { main: { content: string } } }[];
    }[];
  };
}

/** Fetch many pages at once; the map is keyed by the requested title (null = missing) */
async function fetchPages(titles: string[]): Promise<Map<string, Page | null>> {
  const result = new Map<string, Page | null>();
  const todo = [...new Set(titles)];

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const data = await mediawikiApi<QueryResponse>(SITE, {
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      redirects: '1',
      titles: batch.join('|'),
    });

    const q = data.query ?? {};
    const byTitle = new Map<string, Page>();
    for (const p of q.pages ?? []) {
      const content = p.revisions?.[0]?.slots.main.content;
      if (!p.missing && p.pageid && content != null) {
        byTitle.set(p.title, { pageid: p.pageid, title: p.title, wikitext: content });
      }
    }

    for (const requested of batch) {
      let t = requested;
      t = q.normalized?.find((n) => n.from === t)?.to ?? t;
      t = q.redirects?.find((r) => r.from === t)?.to ?? t;
      result.set(requested, byTitle.get(t) ?? null);
    }
  }

  return result;
}

// ── Wikitext helpers ──

/** Remove every {{template}}, nested ones included */
function stripTemplates(text: string): string {
  let out = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('{{', i)) {
      depth++;
      i++;
    } else if (depth > 0 && text.startsWith('}}', i)) {
      depth--;
      i++;
    } else if (depth === 0) {
      out += text[i];
    }
  }
  return out;
}

/** Top-level parameters of the first {{Başlıq}} header template */
function headerParams(wikitext: string): Record<string, string> {
  const start = wikitext.search(/\{\{\s*Başlıq/i);
  if (start < 0) return {};

  // Find the matching close, then split on top-level pipes only
  let depth = 0;
  let end = start;
  for (let i = start; i < wikitext.length; i++) {
    if (wikitext.startsWith('{{', i) || wikitext.startsWith('[[', i)) {
      depth++;
      i++;
    } else if (wikitext.startsWith('}}', i) || wikitext.startsWith(']]', i)) {
      depth--;
      i++;
      if (depth === 0) {
        end = i - 1;
        break;
      }
    }
  }
  const inner = wikitext.slice(start + 2, end);

  const parts: string[] = [];
  let buf = '';
  depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const two = inner.slice(i, i + 2);
    if (two === '{{' || two === '[[') depth++;
    if (two === '}}' || two === ']]') depth--;
    if (inner[i] === '|' && depth === 0) {
      parts.push(buf);
      buf = '';
    } else {
      buf += inner[i];
    }
  }
  parts.push(buf);

  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part
      .slice(eq + 1)
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
      .trim();
    if (value && !value.startsWith('{{')) params[key] = value;
  }
  return params;
}

interface ListLink {
  target: string;
  display: string;
  depth: number;
}

// A {{dəqiqləşdirmə}} page lists same-named works by several authors ({{aydınlaşdırma}} is only a hatnote)
const DISAMBIGUATION = /\{\{\s*dəqiqləşdirmə\s*[}|]/i;
const LIST_LINE = /^([*#]+)\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/;
// Namespaces that never hold a work text
const FOREIGN_NS = /^(Kateqoriya|Category|Müəllif|İndeks|Səhifə|Fayl|Şəkil|File|Image|Portal|Vikipediya|w|wikipedia|commons|Şablon):/i;

/** Links that make up a list (the "table of contents" of an index page) */
function listLinks(wikitext: string, pageTitle: string): ListLink[] {
  const links: ListLink[] = [];
  for (const line of wikitext.split('\n')) {
    const m = line.trim().match(LIST_LINE);
    if (!m) continue;
    let target = m[2].trim().replace(/‎/g, '');
    if (FOREIGN_NS.test(target) || target.startsWith('#')) continue;
    if (target.startsWith('/')) target = pageTitle + target.replace(/\/$/, '');
    links.push({ target, display: (m[3] ?? m[2]).trim(), depth: m[1].length });
  }
  return links;
}

// Latin text on az.wikisource is peppered with Cyrillic look-alikes (е, о, а, х …)
const HOMOGLYPHS: Record<string, string> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', і: 'i', ј: 'j', һ: 'h', ә: 'ə',
  А: 'A', Е: 'E', О: 'O', Р: 'P', С: 'C', Х: 'X', У: 'Y', І: 'I', Ј: 'J', Һ: 'H', Ә: 'Ə',
  К: 'K', М: 'M', Н: 'H', Т: 'T', В: 'B',
};
const CYRILLIC = /[Ѐ-ӿ]/;
const LATIN = /[A-Za-zÀ-ɏəƏ]/;

/** Swap Cyrillic look-alikes for Latin letters inside words that are otherwise Latin */
export function fixHomoglyphs(text: string): string {
  // "Turned e" (ǝ) stands in for schwa on some pages; it is never right in Azerbaijani
  return text.replace(/ǝ/g, 'ə').replace(/Ǝ/g, 'Ə').replace(/[\p{L}\p{M}]+/gu, (word) => {
    const chars = [...word];
    // All-Cyrillic words are left alone (quotes, names); mixed words are typos
    // Single letters ("о" = "that") are always look-alikes in Latin text
    const mixed = chars.some((c) => LATIN.test(c)) || chars.length === 1;
    if (!chars.some((c) => CYRILLIC.test(c)) || !mixed) return word;
    if (chars.some((c) => CYRILLIC.test(c) && !HOMOGLYPHS[c])) return word;
    return chars.map((c) => HOMOGLYPHS[c] ?? c).join('');
  });
}

/** A {{Başlıq}} title as plain text: "Hədiqətüs-süəda.<br>Babi-əvvəl<br>Fəsli-…" → "Fəsli-…" */
function headerTitle(raw: string): string {
  const plain = raw
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '');
  const last = plain.split(/<br\s*\/?>/i).pop() ?? plain;
  return fixHomoglyphs(last.replace(/<[^>]+>/g, '').replace(/'{2,}/g, '').trim());
}

/** The page's own text: header, lists of links, and housekeeping stripped; stanza breaks kept */
function pageText(wikitext: string): string {
  let text = stripTemplates(wikitext);

  // List-of-links lines belong to the index, not the text
  text = text
    .split('\n')
    .filter((line) => !LIST_LINE.test(line.trim()))
    .join('\n');
  text = text.replace(/^=+\s*(Mündəricat|Mündəricə|Məzmun)\s*=+\s*$/gim, '');
  text = text.replace(/\[\[(Kateqoriya|Category):[^\]]*\]\]/gi, '');
  text = text.replace(/\[\[[a-z-]{2,12}:[^\]]*\]\]/g, ''); // interwiki
  text = text.replace(/__[A-ZƏÜÖĞIŞÇ]+__/g, '');

  // <poem>: keep blank lines between stanzas (wikitextToMarkdown would drop them)
  text = text.replace(/<poem[^>]*>([\s\S]*?)<\/poem>/gi, (_, content: string) =>
    '\n' + content.split('\n').map((l) => l.trim()).join('\n') + '\n',
  );

  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text
    .split('\n')
    .map((l) => l.trim().replace(/^:+\s*/, ''))
    .join('\n');

  let md = wikitextToMarkdown(text);
  md = md
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
  md = md.replace(/'{2,}/g, ''); // unbalanced bold/italic quotes
  md = md.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
  return fixHomoglyphs(md.trim());
}

// ── Classification from headings and titles ──

function genreOf(label: string): Genre | undefined {
  const l = label.toLocaleLowerCase('az');
  if (/dram|pyes|komediya|faciə|tamaşa/.test(l)) return 'PLAY';
  if (/məqalə|publisist/.test(l)) return 'ESSAY';
  if (/mənzum/.test(l)) return 'POEM'; // "Mənzum hekayətlər" are tales in verse
  if (/hekayə|povest|roman|(^|\s)nəsr/.test(l)) return 'PROSE';
  if (/fərman|hökm|məktub/.test(l)) return 'LETTER';
  if (/xatirə/.test(l)) return 'MEMOIR';
  return undefined;
}

function formOf(label: string): PoemForm | undefined {
  const l = label.toLocaleLowerCase('az');
  if (/qəzəl/.test(l)) return 'GHAZAL';
  if (/qəsidə/.test(l)) return 'QASIDA';
  if (/rübai/.test(l)) return 'RUBAI';
  if (/mürəbbe/.test(l)) return 'MURABBA';
  if (/məsnəvi/.test(l)) return 'MASNAVI';
  return undefined;
}

/** Headings that hold links but no works */
const NON_WORK_HEADING = /xarici keçid|həmçinin bax|mənbə|ədəbiyyat|istinad|kitabları|haqqında/i;

/** "Qəzəlləri" (his ghazals) → "Qəzəllər"; strips quotes and possessive suffixes */
function headingTitle(heading: string): string {
  return heading
    .replace(/["«»“”]/g, '')
    .replace(/\.\s*(Bakı|Moskva|Tiflis|Təbriz|Tehran)[\s,].*$/, '') // drop ". Bakı, Şərq-Qərb, 2005"
    .replace(/(l[əa]r)[iıuü]$/, '$1')
    .replace(/(['"]?)s[iı]$/, '')
    .trim();
}

// ── Titles and slugs ──

function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .replace(/ǝ/g, 'ə')
      .toLocaleLowerCase('az')
      .replace(/\[\[|\]\]/g, '')
      // Italics and notes: "''Qasım bəy Zakir''", "Qasım bəy Zakir(10cu sinif dərsliyindən)"
      .replace(/'{2,}/g, '')
      .replace(/\([^()]*\)/g, ' ')
      .split(/[\s,]+/)
      .filter((t) => t.length > 2),
  );
}

/** Same person if one name's words are a subset of the other's ("Füzuli" ⊂ "Məhəmməd Füzuli") */
function sameAuthor(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  const subset = (x: Set<string>, y: Set<string>) => [...x].every((t) => y.has(t));
  return ta.size > 0 && tb.size > 0 && (subset(ta, tb) || subset(tb, ta));
}

/** Drop a trailing disambiguator naming the author: "Ana (Hüseyn Cavid)" → "Ana" */
function cleanTitle(title: string, authorTokens: Set<string>): string {
  const leaf = title.split('/').pop() ?? title;
  const m = leaf.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (m && [...nameTokens(m[2])].some((t) => authorTokens.has(t))) return fixHomoglyphs(m[1].trim());
  return fixHomoglyphs(leaf.replace(/[…‎]+$/g, '').trim());
}

/** Readable slug capped at ~70 chars on a word boundary */
function shortSlug(text: string): string {
  const s = slugify(text);
  if (s.length <= 70) return s;
  return s.slice(0, 70).replace(/-[^-]*$/, '');
}

function parseYear(value?: string): number | undefined {
  const m = value?.match(/\b(\d{3,4})\b/);
  return m ? Number(m[1]) : undefined;
}

// ── Walking the author page ──

interface Entry {
  title: string;
  display: string;
  heading: string;
  year?: number;
  /** Children listed under this item on the author page itself (`**` items) */
  children: ListLink[];
}

/** Parse the author page into top-level entries with their section heading */
function authorEntries(wikitext: string): Entry[] {
  const entries: Entry[] = [];
  const headings: { level: number; text: string }[] = [];

  for (const raw of wikitext.split('\n')) {
    const line = raw.trim();
    const h = line.match(/^(=+)\s*(.+?)\s*=+$/);
    if (h) {
      const level = h[1].length;
      while (headings.length && headings[headings.length - 1].level >= level) headings.pop();
      headings.push({ level, text: h[2] });
      continue;
    }

    const m = line.match(LIST_LINE);
    if (!m) continue;
    const target = m[2].trim().replace(/‎/g, '');
    if (FOREIGN_NS.test(target)) continue;

    // Year subsections (Sabir's "1906-cı il") date the works but don't group them
    const yearHeading = [...headings].reverse().find((x) => /^\d{4}-/.test(x.text));
    const section = [...headings].reverse().find((x) => !/^\d{4}-/.test(x.text));
    if (section && NON_WORK_HEADING.test(section.text)) continue;
    if (headings.some((x) => NON_WORK_HEADING.test(x.text))) continue;

    const link: ListLink = { target, display: (m[3] ?? m[2]).trim(), depth: m[1].length };
    if (link.depth > 1 && entries.length) {
      entries[entries.length - 1].children.push(link);
    } else {
      entries.push({
        title: target,
        display: link.display,
        heading: section?.text ?? 'Əsərləri',
        year: parseYear(yearHeading?.text),
        children: [],
      });
    }
  }

  return entries;
}

export async function planWikisourceAz(cfg: AuthorConfig): Promise<WikisourcePlan> {
  const authorName = cfg.wikisource!.az!;
  const authorTokens = nameTokens(authorName);
  // The author page's name, or another spelling pages use for it ("Xurşudbanu Natəvan")
  const isAuthor = (name: string) =>
    [authorName, ...(cfg.wikisource?.az_aliases ?? [])].some((n) => sameAuthor(name, n));
  const overrides = cfg.wikisource?.az_collections ?? {};
  // A poet who never wrote in Azerbaijani: every text here is someone's translation
  const writesAz = cfg.writingLangs.some((l) => l.startsWith('AZ_'));

  const authorPage = (await fetchPages([`Müəllif:${authorName}`])).get(`Müəllif:${authorName}`);
  if (!authorPage) throw new Error(`Author page not found: Müəllif:${authorName}`);

  const entries = authorEntries(authorPage.wikitext);
  const pages = await fetchPages(entries.map((e) => e.title));

  const plan: WikisourcePlan = { collections: [], works: [], skipped: [] };
  const seenPages = new Set<number>();
  const skipSources = new Set(cfg.skipSources);
  const usedSlugs = new Set<string>();

  const uniqueSlug = (base: string) => {
    let slug = base;
    for (let n = 2; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
    usedSlugs.add(slug);
    return slug;
  };

  const collectionFor = (key: string, title: string, genre: Genre, year?: number) => {
    const slug = overrides[key] ?? overrides[title] ?? `${cfg.slug}-${shortSlug(title)}`;
    let coll = plan.collections.find((c) => c.slug === slug);
    if (!coll) {
      const configured = cfg.collections?.find((c) => c.slug === slug);
      coll = {
        slug,
        titleAz: configured?.titleAz ?? title,
        genre: configured?.genre ?? genre,
        year: configured?.year ?? year,
        order: plan.collections.length + 1,
      };
      plan.collections.push(coll);
    }
    return coll;
  };

  /** Accept a page as the author's own original, or record why not */
  const vet = (page: Page | null, title: string): Record<string, string> | null => {
    if (!page) {
      plan.skipped.push({ title, reason: 'missing' });
      return null;
    }
    const params = headerParams(page.wikitext);
    const isEditor = (name?: string) => !!name && EDITORS.some((e) => sameAuthor(e, name));
    const author = params['müəllif'] ?? params['keçidsiz müəllif'];
    if (author && !isEditor(author) && !isAuthor(author)) {
      plan.skipped.push({ title: page.title, reason: 'other-author', detail: author });
      return null;
    }
    const translator = params['tərcüməçi'] ?? params['keçidsiz tərcüməçi'];
    if ((translator && !isEditor(translator)) || !writesAz) {
      plan.skipped.push({ title: page.title, reason: 'translation', detail: translator });
      return null;
    }
    return params;
  };

  const addWork = (
    page: Page,
    params: Record<string, string>,
    display: string,
    coll: PlannedCollection,
    ctx: { form?: PoemForm; year?: number; slugPrefix: string },
  ): boolean => {
    // Listed duplicates and fakes are dropped here, before they can claim a slug
    if (skipSources.has(`wikisource-az-${page.pageid}`)) {
      plan.skipped.push({ title: page.title, reason: 'skip-list' });
      return true;
    }
    let body = pageText(page.wikitext);
    const cut = cfg.wikisource?.az_cut?.[page.title];
    if (cut) {
      const at = body.indexOf(cut);
      if (at < 0) console.warn(`  ${page.title}: "${cut}" not found, not cut`);
      else body = body.slice(0, at).trimEnd();
    }
    if (body.length < MIN_TEXT) return false;

    // Chapter pages often repeat the book's name as their header ("Afət."); the
    // chapter's own name is then in the link text
    const header = params['başlıq'] && headerTitle(params['başlıq']);
    // `[[../]]` (a link to the parent page) is wiki shorthand for the book's name too
    const repeatsBook =
      !!header && (/^\.{0,2}\//.test(header) || header.replace(/[.\s]+$/, '') === coll.titleAz);
    const titleAz =
      cfg.wikisource?.az_titles?.[page.title] ?? (header && !repeatsBook ? header : cleanTitle(display, authorTokens));
    const leaf = cleanTitle(page.title, authorTokens);
    const pageCats = [...page.wikitext.matchAll(/\[\[Kateqoriya:([^\]|]+)/gi)].map((m) => m[1]);

    // Subpage leaves are generic ("Birinci pərdə"), so they carry the parent's name;
    // standalone pages under an index are named well enough with the author alone
    const prefix = page.title.includes('/') ? ctx.slugPrefix : cfg.slug;
    const leafSlug = shortSlug(leaf);
    const base = prefix.endsWith(`-${leafSlug}`) ? prefix : shortSlug(`${prefix}-${leaf}`);

    plan.works.push({
      slug: uniqueSlug(base),
      sourceId: `wikisource-az-${page.pageid}`,
      titleAz,
      collectionSlug: coll.slug,
      genre: coll.genre,
      form: pageCats.map(formOf).find(Boolean) ?? ctx.form,
      year: parseYear(params['il']) ?? ctx.year,
      order: plan.works.filter((w) => w.collectionSlug === coll.slug).length + 1,
      scriptDirection: detectScript(body),
      // Same URL shape the old category scraper wrote, so the importer can adopt those rows
      sourceNote: `https://${SITE}/wiki/${encodeURIComponent(page.title)}`,
      body,
    });
    return true;
  };

  /** A page and everything its list links to, flattened into one collection */
  const walk = async (
    page: Page,
    params: Record<string, string>,
    display: string,
    coll: PlannedCollection,
    ctx: { form?: PoemForm; year?: number; slugPrefix: string },
    extraChildren: ListLink[],
    depth: number,
  ) => {
    if (seenPages.has(page.pageid)) return;
    seenPages.add(page.pageid);

    const children = [...listLinks(page.wikitext, page.title), ...extraChildren];
    const wrote = addWork(page, params, display, coll, ctx);
    if (!wrote && children.length === 0) {
      plan.skipped.push({ title: page.title, reason: 'empty' });
      return;
    }
    if (depth >= MAX_DEPTH || children.length === 0) return;

    // An intermediate index ("Qəzəllər (… Divanı)") names the form of everything under it
    const form = formOf(page.title) ?? ctx.form;
    const fetched = await fetchPages(children.map((c) => c.target));
    for (const child of children) {
      const childPage = fetched.get(child.target) ?? null;
      if (childPage && seenPages.has(childPage.pageid)) continue;
      const childParams = vet(childPage, child.target);
      if (!childPage || !childParams) continue;
      await walk(childPage, childParams, child.display, coll, { ...ctx, form }, [], depth + 1);
    }
  };

  /**
   * Long texts split over pages chained by the header's `növbəti` (next) link:
   * "Bəngü-Badə" → "Bəngü-Badə (Davamı)" → … Followed only while the base title holds,
   * so the chain never runs on into the author's next book.
   */
  const continuation = async (page: Page): Promise<ListLink[]> => {
    const base = (t: string) => t.replace(/\s*\([^()]*\)\s*$/, '');
    const parts: ListLink[] = [];
    let current = page;
    while (parts.length < 20) {
      const next = current.wikitext.match(/\|\s*növbəti\s*=\s*\[\[([^\]|]+)/)?.[1]?.trim();
      if (!next || base(next) !== base(page.title)) break;
      const nextPage = (await fetchPages([next])).get(next);
      if (!nextPage || nextPage.pageid === page.pageid || parts.some((p) => p.target === nextPage.title)) break;
      parts.push({ target: nextPage.title, display: nextPage.title, depth: 1 });
      current = nextPage;
    }
    return parts;
  };

  /**
   * A disambiguation page ("Gərəkdir": Zakir's, Ələsgər's, see also …) stands for the
   * author's own version only — the link whose disambiguator names the author
   */
  const ownVersion = async (page: Page): Promise<Page | null> => {
    if (!DISAMBIGUATION.test(page.wikitext)) return page;
    const links = listLinks(page.wikitext, page.title);
    // The whole name must match: "(Aşıq Alı)" shares "Aşıq" with Aşıq Ələsgər but is someone else
    const own = links.find((l) => {
      const m = l.target.match(/\(([^()]*)\)\s*$/);
      return m && isAuthor(m[1]);
    });
    if (own) return (await fetchPages([own.target])).get(own.target) ?? null;
    // Disambiguated by kind, not author ("Siçan və pişik (şeir)" / "(nağıl)"): the one credited to the author
    const fetched = await fetchPages(links.map((l) => l.target));
    const credited = links
      .map((l) => fetched.get(l.target))
      .find((p) => {
        const params = p && headerParams(p.wikitext);
        const author = params?.['müəllif'] ?? params?.['keçidsiz müəllif'];
        return !!author && isAuthor(author);
      });
    if (!credited) {
      plan.skipped.push({ title: page.title, reason: 'missing', detail: 'disambiguation without own version' });
      return null;
    }
    return credited;
  };

  for (const entry of entries) {
    const listed = pages.get(entry.title) ?? null;
    const page = listed && (await ownVersion(listed));
    if (listed && !page) continue;
    if (page && seenPages.has(page.pageid)) continue;
    const params = vet(page, entry.title);
    if (!page || !params) continue;

    const parts = await continuation(page);
    const hasChildren =
      entry.children.length > 0 || parts.length > 0 || listLinks(page.wikitext, page.title).length > 0;
    const year = parseYear(params['il']) ?? entry.year;
    const sectionGenre = genreOf(entry.heading) ?? 'POEM';

    if (hasChildren) {
      // An index of its own (a divan, a poem in chapters, a play in acts) → its own collection
      // A chained text is named by its base title, not its first part's ("Bəngü-Badə (I hissə)")
      const title = params['başlıq'] && !parts.length
        ? headerTitle(params['başlıq'])
        : cleanTitle(entry.display, authorTokens);
      // The section heading knows the genre better than the title ("Hekayəti…" is a comedy)
      const coll = collectionFor(page.title, title, genreOf(entry.heading) ?? genreOf(title) ?? 'POEM', year);
      const prefix = `${cfg.slug}-${shortSlug(cleanTitle(page.title, authorTokens))}`;
      await walk(page, params, entry.display, coll, {
        form: formOf(title) ?? formOf(entry.heading),
        year,
        slugPrefix: prefix,
      }, [...entry.children, ...parts], 0);

      // A poem page that merely links to variants yields one work — keep it with its section
      const own = plan.works.filter((w) => w.collectionSlug === coll.slug);
      if (own.length === 1 && !overrides[page.title]) {
        own[0].collectionSlug = collectionFor(entry.heading, headingTitle(entry.heading), sectionGenre).slug;
        own[0].genre = sectionGenre;
      }
    } else {
      // A single text under a section heading → the section's collection
      const coll = collectionFor(entry.heading, headingTitle(entry.heading), sectionGenre);
      seenPages.add(page.pageid);
      const wrote = addWork(page, params, entry.display, coll, {
        form: formOf(entry.heading),
        year,
        slugPrefix: cfg.slug,
      });
      if (!wrote) plan.skipped.push({ title: page.title, reason: 'empty' });
    }
  }

  // Pages credited to the author that the author page doesn't link, each into a named collection
  const firstLine = (body: string) =>
    body.split('\n').find((l) => l.trim())?.trim().replace(/[.,;:!?…]+$/, '') ?? '';
  const lineKey = (line: string) => line.toLowerCase().replace(/[^\p{L}]/gu, '').replace(/ı/g, 'i');
  const extra = cfg.wikisource?.az_extra ?? {};
  const extraPages = await fetchPages(Object.keys(extra));
  for (const [title, entry] of Object.entries(extra)) {
    const spec = typeof entry === 'string' ? { collection: entry } : entry;
    const page = extraPages.get(title) ?? null;
    if (page && seenPages.has(page.pageid)) continue;
    const params = vet(page, title);
    if (!page || !params) continue;
    seenPages.add(page.pageid);
    let coll = plan.collections.find((c) => c.slug === spec.collection);
    if (!coll) {
      coll = { slug: spec.collection, titleAz: title, genre: 'POEM', order: plan.collections.length + 1 };
      plan.collections.push(coll);
    }
    if (!spec.separator && !spec.starts) {
      const wrote = addWork(page, params, title, coll, { year: parseYear(params['il']), slugPrefix: cfg.slug });
      if (!wrote) plan.skipped.push({ title: page.title, reason: 'empty' });
      continue;
    }

    // A page of several poems: cut at a separator line or at each poem's first line.
    // The separator ("***") would read as wiki markup, so it becomes a placeholder first
    const CUT = '\u2042CUT\u2042';
    const separator = spec.separator
      ? new RegExp(`^[ \\t]*${spec.separator.replace(/[*.?+^$()[\]{}|\\]/g, '\\$&')}[ \\t]*$`, 'gm')
      : null;
    const body = pageText(separator ? page.wikitext.replace(separator, CUT) : page.wikitext);
    const pieces: string[] = [];
    if (separator) {
      pieces.push(...body.split(CUT));
    } else {
      const starts = spec.starts!.map(lineKey);
      let current: string[] = [];
      for (const line of body.split('\n').filter((l) => l.trim())) {
        if (starts.some((s) => lineKey(line).startsWith(s)) && current.length) {
          pieces.push(current.join('\n'));
          current = [];
        }
        current.push(line.trim());
      }
      pieces.push(current.join('\n'));
    }
    // Stanzas rebuilt from the form when the page's blank lines can't be trusted
    const stanzas = (piece: string) => {
      if (!spec.stanza) return piece.trim();
      const lines = piece.split('\n').filter((l) => l.trim());
      const out: string[] = [];
      for (let i = 0; i < lines.length; i += spec.stanza) out.push(lines.slice(i, i + spec.stanza).join('\n'));
      return out.join('\n\n');
    };
    const known = new Set(plan.works.map((w) => lineKey(firstLine(w.body))));
    pieces.map(stanzas).filter((p) => p.length >= MIN_TEXT).forEach((piece, i) => {
      const titleAz = firstLine(piece);
      const sourceId = `wikisource-az-${page.pageid}-${i + 1}`;
      // Variants of a poem the author already has, spelt too differently to match on the first line
      if (skipSources.has(sourceId)) {
        plan.skipped.push({ title: `${page.title} → ${titleAz}`, reason: 'skip-list' });
        return;
      }
      if (known.has(lineKey(titleAz))) {
        plan.skipped.push({ title: `${page.title} → ${titleAz}`, reason: 'duplicate' });
        return;
      }
      known.add(lineKey(titleAz));
      plan.works.push({
        slug: uniqueSlug(shortSlug(`${cfg.slug}-${titleAz}`)),
        sourceId,
        titleAz,
        collectionSlug: coll!.slug,
        genre: coll!.genre,
        form: spec.form,
        year: parseYear(params['il']),
        order: plan.works.filter((w) => w.collectionSlug === coll!.slug).length + 1,
        scriptDirection: detectScript(piece),
        sourceNote: `https://${SITE}/wiki/${encodeURIComponent(page.title)}`,
        body: piece,
      });
    });
  }

  // Sections whose every entry was skipped (or folded away) leave empty collections behind
  plan.collections = plan.collections.filter((c) => plan.works.some((w) => w.collectionSlug === c.slug));
  plan.collections.forEach((c, i) => {
    c.order = i + 1;
    plan.works.filter((w) => w.collectionSlug === c.slug).forEach((w, j) => (w.order = j + 1));
  });
  return plan;
}
