/**
 * A verse translation printed as one poem in the translator's own sections, cut by hand into
 * our works: James Atkinson's Laili and Majnun (1836), an abridged paraphrase of Nizami.
 * The config names, for each work, the English line its rendering starts with; the text in
 * between goes to the work before. Works the translator skipped are simply not named.
 *
 * Read from Internet Archive's word positions (`_djvu.xml`): footnotes are set in smaller
 * type than the verse, and a line too long for the measure carries on indented below it.
 */
import * as fs from 'fs';
import * as path from 'path';
import { cachedGet, cachedGetJson } from '../utils/http';
import { bookLines, type Line } from './anthology';

const CONFIG_DIR = path.resolve(__dirname, '../../data/config/translations');

export interface SplitConfig {
  id: string;
  layout: 'split';
  archiveId: string;
  title: string;
  translator: string;
  year: number;
  translatorNote?: string;
  workSlugBase: string;
  /** Letter height (scan pixels) below which a line is a footnote */
  noteHeight: number;
  /** The poem's first and last lines, as printed */
  first: string;
  last: string;
  /** Page headers ("THE LOVES OF", "LAILI AND MAJNUN 3"), as a pattern */
  runningHeads: string;
  /** Work number → the English line its rendering starts with */
  starts: Record<string, string>;
  /** Proofreading corrections, checked against the scan: exact text or a pattern */
  corrections?: ({ from: string; to: string } | { pattern: string; flags?: string; to: string })[];
}

export interface SplitTranslation {
  workSlug: string;
  couplets: number;
  opening: string;
  body: string;
  warnings: string[];
}

export function loadSplitConfig(id: string): SplitConfig {
  return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, `${id}.json`), 'utf-8'));
}

/** The poem's verse lines in order, footnotes and page furniture gone, wrapped lines rejoined */
export async function poemLines(cfg: SplitConfig, opts: { sections?: boolean } = {}): Promise<string[]> {
  const meta = await cachedGetJson<{ result: { name: string }[] }>(`https://archive.org/metadata/${cfg.archiveId}/files`);
  const xmlName = meta.result.find((f) => f.name.endsWith('_djvu.xml'))?.name;
  if (!xmlName) throw new Error(`No OCR word positions in ${cfg.archiveId}`);
  const lines = bookLines(await cachedGet(`https://archive.org/download/${cfg.archiveId}/${encodeURIComponent(xmlName)}`));

  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const start = lines.findIndex((l) => norm(l.text).startsWith(cfg.first));
  const end = lines.findIndex((l, i) => i > start && norm(l.text).startsWith(cfg.last));
  if (start < 0 || end < 0) throw new Error(`First or last line not found: "${start < 0 ? cfg.first : cfg.last}"`);

  const heads = new RegExp(cfg.runningHeads);
  // Each page's verse margin: the left edge most of its lines start at
  const margins = new Map<number, number>();
  const byPage = new Map<number, Line[]>();
  for (const l of lines.slice(start, end + 1)) byPage.set(l.page, [...(byPage.get(l.page) ?? []), l]);
  for (const [page, ls] of byPage) {
    const xs = ls.filter((l) => l.height >= cfg.noteHeight).map((l) => l.x).sort((a, b) => a - b);
    margins.set(page, xs[Math.floor(xs.length / 2)] ?? 0);
  }

  const out: string[] = [];
  for (const l of lines.slice(start, end + 1)) {
    const text = norm(l.text);
    // Running heads, and the rows of asterisks between scenes
    if (!text || heads.test(text) || /^[*•■\s]+$/.test(text)) continue;
    // Page numbers, signature letters, section numerals (kept as "§ IV" for aligning by hand)
    if (/^([\divxlcIVXLC.\s]{1,7}|[A-Z])$/.test(text)) {
      if (opts.sections && /^[ivxlcIVXLC]+\.?$/.test(text) && l.height === 0 && l.x > (margins.get(l.page) ?? 0) + 150) out.push(`§ ${text}`);
      continue;
    }
    if (l.height > 0 && l.height < cfg.noteHeight) continue;
    // A word or two in lowercase: set right of the margin, the end of the verse line above;
    // left of it, the last words of a footnote
    const margin = margins.get(l.page) ?? l.x;
    if (/^[a-z]/.test(text) && text.split(' ').length <= 3) {
      if (out.length && l.x > margin + 60) out[out.length - 1] += ` ${text}`;
      continue;
    }
    out.push(text);
  }
  // Superscript footnote markers read as digits or stray letters after a word: "Saki,1", "veil l o'er"
  return out.map((t) => t.replace(/([A-Za-z,;:.!?'’])\d\b/g, '$1').replace(/\s+([,;:.!?])/g, '$1').trim());
}

export async function planSplit(cfg: SplitConfig): Promise<{ translations: SplitTranslation[]; unusedCorrections: string[] }> {
  const used = new Set<number>();
  let text = (await poemLines(cfg)).join('\n');
  (cfg.corrections ?? []).forEach((c, i) => {
    const next = 'from' in c ? text.split(c.from).join(c.to) : text.replace(new RegExp(c.pattern, c.flags ?? 'g'), c.to);
    if (next !== text) used.add(i);
    text = next;
  });
  const lines = text.split('\n').filter((l) => l.trim());

  const starts = Object.entries(cfg.starts)
    .map(([n, opening]) => {
      const at = lines.findIndex((l) => l.startsWith(opening));
      if (at < 0) throw new Error(`Work ${n}: no line starting "${opening}"`);
      return { n: Number(n), at };
    })
    .sort((a, b) => a.at - b.at);

  const translations = starts.map(({ n, at }, i) => {
    const chunk = lines.slice(at, starts[i + 1]?.at ?? lines.length);
    const warnings: string[] = [];
    if (chunk.length % 2) warnings.push(`${chunk.length} lines, odd`);
    const couplets: string[] = [];
    // Paired like the original's couplets; English rhymes are too irregular in spelling to check
    for (let k = 0; k < chunk.length; k += 2) couplets.push(chunk.slice(k, k + 2).join('\n'));
    return {
      workSlug: `${cfg.workSlugBase}-${n}`,
      couplets: couplets.length,
      opening: chunk.slice(0, 2).join(' / '),
      body: couplets.join('\n\n'),
      warnings,
    };
  });
  const unusedCorrections = (cfg.corrections ?? [])
    .filter((_, i) => !used.has(i))
    .map((c) => ('from' in c ? c.from : `/${c.pattern}/`));
  return { translations, unusedCorrections };
}
