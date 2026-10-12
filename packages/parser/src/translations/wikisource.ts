/**
 * A translation published on az.wikisource as an index page of chapters, aligned to our
 * works by hand: the config names, for each work, the chapter it starts with. Chapters in
 * between belong to the work before them (a translation made from a fuller edition has more
 * chapters than Ganjoor's sections); a work can also start partway into a chapter.
 */
import * as fs from 'fs';
import * as path from 'path';
import { mediawikiApi } from '../utils/http';
import { fixHomoglyphs } from '../scrapers/wikisource-az';
import { titleCase } from '../scrapers/book-pdf';

const CONFIG_DIR = path.resolve(__dirname, '../../data/config/translations');
const SITE = 'az.wikisource.org';

export interface WikisourceTranslationConfig {
  id: string;
  layout: 'wikisource';
  title: string;
  translator: string;
  translatorNote?: string;
  /** Why the translation must stay a draft for now (still in copyright) */
  hold?: string;
  /** The index page that lists the chapters */
  index: string;
  workSlugBase: string;
  /** Work number → the chapter it starts with, or "chapter @ first words" to start inside one */
  starts: Record<string, string>;
  /** Misplaced line breaks and the like, fixed in the chapter text before it is split */
  corrections?: { from: string; to: string }[];
  /** Words kept capitalised when a heading in capitals is set in sentence case */
  names?: string[];
}

export interface WikisourceTranslation {
  workSlug: string;
  chapters: string[];
  couplets: number;
  body: string;
  sourceUrl: string;
  warnings: string[];
}

export function loadWikisourceConfig(id: string): WikisourceTranslationConfig {
  return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, `${id}.json`), 'utf-8'));
}

interface RevisionsResponse {
  query: { pages: { title: string; missing?: boolean; revisions?: { slots: { main: { content: string } } }[] }[] };
}

async function wikitexts(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 40) {
    const data = await mediawikiApi<RevisionsResponse>(SITE, {
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      titles: titles.slice(i, i + 40).join('|'),
    });
    for (const p of data.query.pages) {
      const text = p.revisions?.[0]?.slots.main.content;
      if (text) out.set(p.title, text);
    }
  }
  return out;
}

/** A line in capitals: a heading set inside the verse */
const isHeading = (line: string) => /\p{Lu}{3}/u.test(line) && !/\p{Ll}/u.test(line);

const pageUrl = (title: string) => `https://${SITE}/wiki/${encodeURIComponent(title)}`;

export async function planWikisourceTranslation(cfg: WikisourceTranslationConfig): Promise<WikisourceTranslation[]> {
  const index = (await wikitexts([cfg.index])).get(cfg.index);
  if (!index) throw new Error(`Index page not found: ${cfg.index}`);
  const chapterTitles = [...index.matchAll(/\[\[([^\]|]+\/[^\]|]+)(?:\|[^\]]*)?\]\]/g)]
    .map((m) => m[1].trim())
    .filter((t) => t.startsWith(`${cfg.index}/`));
  const texts = await wikitexts(chapterTitles);

  // Each chapter's verse lines, corrections applied
  const chapters = chapterTitles.map((title) => {
    let text = texts.get(title) ?? '';
    // Trimmed and without blank lines first, so corrections can quote lines as they read
    text = (text.match(/<poem>([\s\S]*?)<\/poem>/)?.[1] ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n');
    for (const c of cfg.corrections ?? []) text = text.split(c.from).join(c.to);
    const lines = fixHomoglyphs(text).split('\n');
    return { title, name: title.slice(cfg.index.length + 1), lines };
  });

  // Where each work starts: a chapter index, and a line within it
  const starts = Object.entries(cfg.starts)
    .map(([n, spec]) => {
      const [name, words] = spec.split(' @ ').map((s) => s.trim());
      const c = chapters.findIndex((ch) => ch.name === name);
      if (c < 0) throw new Error(`Work ${n}: no chapter "${name}"`);
      const line = words ? chapters[c].lines.findIndex((l) => l.startsWith(words)) : 0;
      if (line < 0) throw new Error(`Work ${n}: "${words}" not found in "${name}"`);
      return { n: Number(n), c, line };
    })
    .sort((a, b) => a.c - b.c || a.line - b.line);
  if (starts[0]?.c !== 0 || starts[0].line !== 0) throw new Error('The first work must start at the first chapter');

  return starts.map((start, i) => {
    const next = starts[i + 1];
    const end = next ?? { c: chapters.length - 1, line: chapters[chapters.length - 1].lines.length };
    const parts: { name: string; lines: string[]; continued: boolean }[] = [];
    for (let c = start.c; c <= end.c; c++) {
      const from = c === start.c ? start.line : 0;
      const to = next && c === next.c ? next.line : chapters[c].lines.length;
      if (to > from) parts.push({ name: chapters[c].name, lines: chapters[c].lines.slice(from, to), continued: from > 0 });
    }

    const warnings: string[] = [];
    // Verse in couplets; a run of lines in capitals inside a chapter is a heading of its own
    const verse = (name: string, lines: string[]) => {
      const out: string[] = [];
      let run: string[] = [];
      let heading: string[] = [];
      const flush = () => {
        if (heading.length) out.push(`### ${titleCase(heading.join(' '), cfg.names ?? [])}`);
        heading = [];
        if (!run.length) return;
        // Couplets rhyme (aa bb …): three unrhymed ones in a row mean a line is missing or split
        const rhyme = (l: string) => l.toLowerCase().replace(/[^\p{L}]/gu, '').slice(-2);
        for (let k = 0; k + 5 < run.length; k += 2) {
          if ([0, 2, 4].every((d) => rhyme(run[k + d]) !== rhyme(run[k + d + 1]))) {
            warnings.push(`"${name}": couplets stop rhyming at "${run[k].slice(0, 40)}"`);
            break;
          }
        }
        if (run.length % 2) {
          warnings.push(`"${name}": ${run.length} lines from "${run[0].slice(0, 30)}", left unpaired`);
          out.push(run.join('\n'));
        } else {
          const couplets: string[] = [];
          for (let k = 0; k < run.length; k += 2) couplets.push(`${run[k]}\n${run[k + 1]}`);
          out.push(couplets.join('\n\n'));
        }
        run = [];
      };
      for (const line of lines) {
        // "* * *" divides a chapter; the couplets on either side are counted apart
        if (/^[*\s]+$/.test(line)) {
          flush();
          continue;
        }
        if (isHeading(line)) {
          if (run.length) flush();
          heading.push(line);
        } else {
          if (heading.length && !run.length) {
            out.push(`### ${titleCase(heading.join(' '), cfg.names ?? [])}`);
            heading = [];
          }
          run.push(line);
        }
      }
      flush();
      return out.join('\n\n');
    };
    // One heading per chapter when a work holds several, so the translator's divisions show
    const body = parts
      .map((p) => {
        const text = verse(p.name, p.lines);
        return parts.length > 1 && !p.continued ? `### ${p.name}\n\n${text}` : text;
      })
      .join('\n\n');

    const first = parts[0];
    return {
      workSlug: `${cfg.workSlugBase}-${start.n}`,
      chapters: parts.map((p) => p.name + (p.continued ? ' (continued)' : '')),
      couplets: Math.floor(parts.reduce((n, p) => n + p.lines.length, 0) / 2),
      body,
      sourceUrl: pageUrl(chapters.find((ch) => ch.name === first.name)!.title),
      warnings,
    };
  });
}
