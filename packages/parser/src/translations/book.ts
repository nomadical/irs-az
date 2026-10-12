/**
 * Public-domain book translations from Internet Archive, aligned to our works.
 *
 * A book config lists the book's own section headings in order and which of our works
 * (by order in the collection) each belongs to. Several book sections can make up one
 * work; one book section spanning two works is divided by the works' couplet counts —
 * these older translations render one couplet per paragraph.
 */
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { cachedGet, cachedGetJson } from '../utils/http';
import { Vocabulary, cleanParagraph, similarity, type OcrStats } from './ocr';
import { parseCantos } from './cantos';

const DATA_DIR = path.resolve(__dirname, '../../data');
// Real headings score 0.85+; the loose threshold is a fallback for badly garbled ones,
// tried only when no strong match exists, so a couplet echoing a heading isn't taken for it
const HEADING_STRONG = 0.8;
const HEADING_MATCH = 0.62;
const RUNNING_HEAD_MATCH = 0.55;

export interface BookConfig {
  id: string;
  archiveId: string;
  title: string;
  translator: string;
  year: number;
  authorSlug: string;
  collectionSlug: string;
  /**
   * "headings" (default): sections found by their headings, one couplet per paragraph (Wilson).
   * "cantos": numbered cantos with two-line couplets and page footnotes (Clarke).
   */
  layout?: 'headings' | 'cantos';
  /** Page headers as printed ("THE HAFT PAIKAR"); OCR variants are matched loosely */
  runningHeads: string[];
  /** cantos layout: where canto I begins when the book prints no "CANTO I." line */
  firstCanto?: string;
  /**
   * Proofreading corrections, checked against the scan, applied to each finished section in
   * order: exact text ({from, to}) or a pattern ({pattern, flags?, to}). Unmatched ones are
   * reported, so a correction that no longer applies doesn't linger unnoticed.
   */
  corrections?: ({ from: string; to: string } | { pattern: string; flags?: string; to: string })[];
  /** Couplets matching this are stray footnote fragments ("signifies", "See couplet 12") */
  dropPattern?: string;
  /**
   * Drop "couplets" that are a wrapped prose sentence — a footnote the layout let through:
   * the first line breaks without closing punctuation and the second carries on in lowercase
   * ("…by the black helmets; and the / lightning by the sword-sheen."), or, in the cantos
   * layout, the first line itself opens in lowercase ("life, a thousand years)."). Verse lines
   * open with a capital and end a clause; fused verse paragraphs (over 120 characters) are
   * left for corrections.
   */
  dropWrappedProse?: boolean;
  /**
   * An interlude the book prints at the end of a section but the original opens the next one
   * with — Clarke closes a canto with "Come, cup-bearer! …" where Ganjoor's next section
   * starts «بیا ساقی». english: how the book's address begins; original: how the work's does.
   */
  movedInterlude?: { english: string; original: string };
  endMarker?: string;
  /** Whole-word OCR misreadings that are real words ("Bahrain" for Bahram) */
  replacements?: Record<string, string>;
  /** Proofread against the scan: the translations no longer carry the OCR caveat */
  proofread?: boolean;
  /** heading: shown in the translation; match: the body's wording when it differs from the contents */
  /**
   * heading: the book's section title (headings layout: also how it is found); canto: the canto
   * number (cantos layout). splitAt: for a section over several works, the opening words of
   * each later work's first couplet.
   */
  sections: { heading: string; canto?: number; match?: string; ganjoor: number | number[]; splitAt?: string[] }[];
}

export interface PlannedTranslation {
  workSlug: string;
  order: number;
  workTitle: string;
  body: string;
  couplets: number;
  originalCouplets: number;
  /** First couplet, for eyeballing the alignment */
  opening: string;
}

export interface BookPlan {
  translations: PlannedTranslation[];
  /** Corrections that matched nothing in any section */
  unusedCorrections: string[];
  missingHeadings: string[];
  ocr: OcrStats;
  sourceUrl: string;
}

export function loadBookConfig(id: string): BookConfig {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config/translations', `${id}.json`), 'utf-8'));
}

/** An Internet Archive item's OCR file: `_djvu.txt` (plain text) or `_djvu.xml` (word positions) */
async function fetchText(archiveId: string, suffix = '_djvu.txt'): Promise<string> {
  const meta = await cachedGetJson<{ result: { name: string }[] }>(`https://archive.org/metadata/${archiveId}/files`);
  const file = meta.result.find((f) => f.name.endsWith(suffix));
  if (!file) throw new Error(`No ${suffix} in ${archiveId}`);
  return cachedGet(`https://archive.org/download/${archiveId}/${encodeURIComponent(file.name)}`);
}

interface WorkFile {
  slug: string;
  order: number;
  title: string;
  couplets: number;
  /** First couplet of the original */
  opening: string;
}

/** Our works in the collection, by order, with their couplet counts */
function collectionWorks(cfg: BookConfig): Map<number, WorkFile> {
  const dir = path.join(DATA_DIR, 'works', cfg.authorSlug, cfg.collectionSlug);
  const works = new Map<number, WorkFile>();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const { data, content } = matter(fs.readFileSync(path.join(dir, f), 'utf-8'));
    works.set(data.order, {
      slug: data.slug,
      order: data.order,
      title: data.titleFa ?? data.titleAz,
      couplets: content.split(/\n\s*\n/).filter((p) => p.trim()).length,
      opening: content.trim().split(/\n\s*\n/)[0] ?? '',
    });
  }
  return works;
}

/** Paragraphs of the book with page furniture removed; a page break mid-couplet is rejoined */
function paragraphs(text: string, cfg: BookConfig): string[] {
  const isRunningHead = (t: string) => {
    const caps = t.replace(/[^A-Za-z]/g, '');
    // Mostly capitals and close to a known page header: "TEAJSrSLATION", "THE H.4FT PAIKAR 104"
    if (caps.length < 6 || caps.replace(/[^A-Z]/g, '').length < caps.length * 0.7) return false;
    return cfg.runningHeads.some((h) => similarity(t, h) >= RUNNING_HEAD_MATCH);
  };
  const lines = text
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => {
      const t = l.trim();
      // Page numbers, roman numerals, printer's signature letters ("B", "E")
      if (/^[\divxlcIVXLC.\s]{1,6}$/.test(t) || /^[A-Z]{1,2}$/.test(t)) return false;
      return !isRunningHead(t);
    });

  const paras: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) paras.push(buf.join('\n'));
    buf = [];
  };
  for (const line of lines) {
    if (line.trim()) buf.push(line.trim());
    else flush();
  }
  flush();

  // A paragraph starting in lowercase continues the previous one across a page break
  const merged: string[] = [];
  for (const p of paras) {
    if (merged.length && /^[a-z]/.test(p)) merged[merged.length - 1] += '\n' + p;
    else merged.push(p);
  }
  return merged;
}

/** Where each heading sits in the body, in order. Contents entries end in page numbers and are skipped. */
function locateHeadings(paras: string[], cfg: BookConfig): { index: number[]; missing: string[] } {
  const index: number[] = [];
  const missing: string[] = [];
  let from = 0;
  for (const s of cfg.sections) {
    const target = s.match ?? s.heading;
    const find = (threshold: number) => {
      for (let i = from; i < paras.length; i++) {
        const p = paras[i];
        // Headings are short; contents entries end in a page number
        if (p.length > target.length * 1.6 + 20 || /\d\s*$/.test(p)) continue;
        if (similarity(p.replace(/\(\s*\d+\s*\)/g, ''), target) >= threshold) return i;
      }
      return -1;
    };
    let found = find(HEADING_STRONG);
    if (found < 0) found = find(HEADING_MATCH);
    index.push(found);
    if (found < 0) missing.push(s.heading);
    else from = found + 1;
  }
  return { index, missing };
}

function applyReplacements(text: string, replacements?: Record<string, string>): string {
  if (!replacements) return text;
  return text.replace(/[A-Za-z]+/g, (w) => replacements[w] ?? w);
}

/** Headings layout: each config section's raw couplets (one paragraph each), or the missing headings */
function headingSections(text: string, cfg: BookConfig): { sections: string[][]; missing: string[] } {
  let paras = paragraphs(text, cfg);
  const { index, missing } = locateHeadings(paras, cfg);
  if (missing.length) return { sections: [], missing };

  // The last section runs to the end marker (index, advertisements)
  const end = cfg.endMarker
    ? paras.findIndex((p, i) => i > index[index.length - 1] && new RegExp(cfg.endMarker!).test(p))
    : -1;
  paras = paras.slice(0, end > 0 ? end : paras.length);
  return {
    sections: cfg.sections.map((_, k) => paras.slice(index[k] + 1, k + 1 < index.length ? index[k + 1] : paras.length)),
    missing: [],
  };
}

// Separates the two lines of a canto couplet; a plain newline is only an OCR line wrap
const LINE_BREAK = '\u2028';

/** Cantos layout: each config section's raw couplets, two lines each joined by LINE_BREAK */
function cantoSections(layoutXml: string, cfg: BookConfig): { sections: string[][]; missing: string[] } {
  const { cantos } = parseCantos(layoutXml, cfg.runningHeads, cfg.firstCanto ? new RegExp(cfg.firstCanto) : undefined);
  const byNumber = new Map(cantos.map((c) => [c.number, c]));
  const missing = cfg.sections.filter((s) => !byNumber.has(s.canto!)).map((s) => `Canto ${s.canto}: ${s.heading}`);
  return {
    sections: cfg.sections.map((s) => (byNumber.get(s.canto!)?.couplets ?? []).map((c) => c.join(LINE_BREAK))),
    missing,
  };
}

/**
 * Couplets put back together once footnote lines are gone (cantos layout):
 *   - a wrapped half-line read as a couplet of its own (". ivory (day);", ", with) sugar-lumps;")
 *     goes back onto the line it continues;
 *   - two lone halves in a row are one couplet.
 */
function repair(couplets: string[]): string[] {
  const open = (line: string) => !/[,;:.!?—)"']\s*$/.test(line);
  const continuation = /^[.,]?\s*(?=[a-z])/;
  const out: string[][] = [];
  for (const c of couplets) {
    const lines = c.split('\n');
    const prev = out[out.length - 1];
    const last = prev?.[prev.length - 1];
    if (prev && open(last) && continuation.test(lines[0]) && (lines.length === 1 || prev.length === 1)) {
      prev[prev.length - 1] = `${last} ${lines[0].replace(continuation, '')}`;
      prev.push(...lines.slice(1));
    } else if (prev && prev.length === 1 && lines.length === 1) {
      prev.push(lines[0]);
    } else {
      out.push(lines);
    }
  }
  return out.map((lines) => lines.join('\n'));
}

export async function planBookTranslation(cfg: BookConfig): Promise<BookPlan> {
  const text = await fetchText(cfg.archiveId);
  const vocab = new Vocabulary(text);
  const ocr: OcrStats = { fixed: 0, unknown: 0, words: 0 };
  const sourceUrl = `https://archive.org/details/${cfg.archiveId}`;

  const { sections, missing } =
    cfg.layout === 'cantos'
      ? cantoSections(await fetchText(cfg.archiveId, '_djvu.xml'), cfg)
      : headingSections(text, cfg);
  if (missing.length) return { translations: [], missingHeadings: missing, ocr, sourceUrl, unusedCorrections: [] };

  const works = collectionWorks(cfg);
  const groups = new Map<number, string[]>();
  // A two-line couplet keeps its line break; each line is cleaned on its own
  const clean = (couplet: string) =>
    couplet
      .split(LINE_BREAK)
      .map((line) => applyReplacements(cleanParagraph(line, vocab, ocr), cfg.replacements))
      // A verse line has a word; OCR specks ("jt", "i rp", "« n") don't
      .filter((line) => /[A-Za-z]{3,}/.test(line))
      // A margin number read as letters just inside the edge: "fi0 Both hands", "e The hill"
      .map((line) => (cfg.layout === 'cantos' ? line.replace(/^[a-z][a-z0-9?*°]{0,2}\s+(?=["'«(]?\s*[A-Z])/, '') : line))
      .join('\n');

  const drop = cfg.dropPattern ? new RegExp(cfg.dropPattern, 'i') : null;
  const wrappedProse = (p: string) => {
    const [first, second, ...rest] = p.split('\n');
    if (rest.length || second === undefined) return false;
    return /^[a-z]{2,}\b/.test(second) && first.length <= 120 && !/[;:.!?"]\s*$/.test(first);
  };
  const cleaned = sections.map((sec) => {
    const kept = sec.map(clean).filter((p) => p.length > 0 && !drop?.test(p) && !(cfg.dropWrappedProse && wrappedProse(p)));
    if (cfg.layout !== 'cantos') return kept;
    // Once wrapped half-lines are back in place, a couplet opening in lowercase is the tail
    // of a note: "life, a thousand years). / The pumpkin represents…"
    return repair(kept).filter((p) => !(cfg.dropWrappedProse && /^[a-z]{3,}\b/.test(p)));
  });

  // Move a section-closing interlude to the start of the next section, where the original has it
  if (cfg.movedInterlude) {
    const english = new RegExp(cfg.movedInterlude.english, 'i');
    const original = new RegExp(cfg.movedInterlude.original);
    const first = (g: number | number[]) => (Array.isArray(g) ? g[0] : g);
    const last = (g: number | number[]) => (Array.isArray(g) ? g[g.length - 1] : g);
    for (let k = 0; k + 1 < cfg.sections.length; k++) {
      const next = first(cfg.sections[k + 1].ganjoor);
      if (next === last(cfg.sections[k].ganjoor) || !original.test(works.get(next)?.opening ?? '')) continue;
      const tail = cleaned[k].length - 6;
      const at = cleaned[k].findIndex((c, i) => i >= tail && english.test(c.split('\n')[0]));
      if (at > 0) cleaned[k + 1].unshift(...cleaned[k].splice(at));
    }
  }

  cfg.sections.forEach((s, k) => {
    const couplets = cleaned[k];
    const targets = Array.isArray(s.ganjoor) ? s.ganjoor : [s.ganjoor];

    // One book section over several works: cut where each later work's first couplet begins
    // (splitAt). Without an anchor, top each work up to its couplet count, counting what earlier
    // book sections already gave it; the last work takes the rest
    let start = 0;
    targets.forEach((t, j) => {
      const anchor = s.splitAt?.[j];
      const cut = anchor
        ? couplets.findIndex((c, i) => i > start && similarity(c.slice(0, anchor.length + 10), anchor) >= 0.7)
        : -1;
      if (anchor && cut < 0) throw new Error(`splitAt not found in "${s.heading}": ${anchor}`);
      const have = (groups.get(t) ?? []).length;
      const need = Math.max(0, (works.get(t)?.couplets ?? 0) - have);
      const take =
        j === targets.length - 1 ? couplets.length - start : cut >= 0 ? cut - start : Math.min(need, couplets.length - start);
      const part = couplets.slice(start, start + take);
      start += take;
      // The book's own headings are left out: the original has none there, and in the
      // side-by-side view they would push every English couplet off its Persian one
      groups.set(t, [...(groups.get(t) ?? []), ...part]);
    });
  });

  const used = new Set<number>();
  const correct = (body: string) =>
    (cfg.corrections ?? []).reduce((text, c, i) => {
      const next = 'from' in c ? text.split(c.from).join(c.to) : text.replace(new RegExp(c.pattern, c.flags ?? 'g'), c.to);
      if (next !== text) used.add(i);
      return next;
    }, body);

  const translations: PlannedTranslation[] = [];
  for (const [order, couplets] of [...groups].sort((a, b) => a[0] - b[0])) {
    const work = works.get(order);
    if (!work) throw new Error(`${cfg.collectionSlug} has no work with order ${order}`);
    const body = correct(couplets.join('\n\n')).replace(/\n{3,}/g, '\n\n').trim();
    translations.push({
      workSlug: work.slug,
      order,
      workTitle: work.title,
      body,
      couplets: body.split(/\n\s*\n/).length,
      originalCouplets: work.couplets,
      opening: couplets[0] ?? '',
    });
  }

  const unusedCorrections = (cfg.corrections ?? [])
    .filter((_, i) => !used.has(i))
    .map((c) => ('from' in c ? c.from : `/${c.pattern}/`));
  return { translations, missingHeadings: [], ocr, sourceUrl, unusedCorrections };
}
