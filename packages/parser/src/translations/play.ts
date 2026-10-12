/**
 * Plays translated in an old printed edition with an OCR text layer — Axundzade's own Russian
 * versions of his comedies (Tiflis, 1853). The config names where each of our works begins
 * (a page and the words that open it); a work runs to the next one's start.
 *
 * The edition sets each speaker's name in capitals on a line of its own, stage directions in
 * parentheses, and footnotes marked (*) at the page foot. Paragraphs are rebuilt in our
 * plays' shape ("Speaker: speech"), and the pre-1918 spelling is modernised letter by letter.
 */
import * as fs from 'fs';
import * as path from 'path';
import { pdfDocument } from '../scrapers/book-pdf';

const CONFIG_DIR = path.resolve(__dirname, '../../data/config/translations');
/** Works transcribed by hand from the scans, where the OCR was too poor to correct: <book id>/<work slug>.txt */
const PROOFREAD_DIR = path.resolve(__dirname, '../../data/proofread');

export interface PlayConfig {
  id: string;
  layout: 'play';
  url: string;
  title: string;
  translator: string;
  year: number;
  translatorNote?: string;
  /** Where each work begins: a PDF page (0-based) and the words that open it there; `cast` for a
   * play's list of characters, kept line by line up to the first act (a play that is one work of
   * ours goes on from there as usual) */
  parts: { workSlug: string; page: number; at: string; cast?: boolean }[];
  /** The last PDF page of the last work */
  lastPage: number;
  /** Proofreading corrections, applied to each finished work: exact text or a pattern */
  corrections?: ({ from: string; to: string } | { pattern: string; flags?: string; to: string })[];
}

export interface PlayTranslation {
  workSlug: string;
  paragraphs: number;
  opening: string;
  body: string;
  /** Transcribed by hand from the scans, not OCR */
  proofread: boolean;
}

export function loadPlayConfig(id: string): PlayConfig {
  return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, `${id}.json`), 'utf-8'));
}

// Latin letters the OCR puts inside Cyrillic words
const LATIN_TO_CYRILLIC: Record<string, string> = {
  a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н',
  K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х',
};
const fixMixedScript = (text: string) =>
  text.replace(/[\p{L}]+/gu, (word) =>
    /[а-яё]/i.test(word) && /[A-Za-z]/.test(word) ? [...word].map((c) => LATIN_TO_CYRILLIC[c] ?? c).join('') : word,
  );

/** Pre-1918 letters and endings in today's spelling: ѣ → е, і → и, ѳ → ф, a final ъ dropped, -аго → -ого */
export function modernise(text: string): string {
  return text
    .replace(/ѣ/g, 'е').replace(/Ѣ/g, 'Е')
    .replace(/і/g, 'и').replace(/І/g, 'И')
    .replace(/ѳ/g, 'ф').replace(/Ѳ/g, 'Ф')
    .replace(/ѵ/g, 'и').replace(/Ѵ/g, 'И')
    .replace(/([а-яё])ъ(?![а-яё])/gi, '$1')
    .replace(/([а-яё]{2,})аго(?![а-яё])/gi, '$1ого')
    .replace(/([а-яё]{2,})яго(?![а-яё])/gi, '$1его');
}

/** Act headings, however the OCR spells them: "ЛѢЙСТВІЕ", "ДѢЙ5ТВІЕ", "ДѢНСТВІЕ" */
const ACT = /^[ДЛ]Ѣ\S{0,3}ТВ[ІИ]Е\s+(\S+?)\.?$/;

/** A speaker's line: a name in capitals, maybe with a direction in parentheses */
const SPEAKER = /^([A-ZА-ЯЁІѢѲ0-9][A-ZА-ЯЁІѢѲ0-9\s.,\-—'"»«]{2,}?)\.?\s*(\(.*)?$/;
const isSpeaker = (line: string) => {
  const m = line.match(SPEAKER);
  return !!m && /[А-ЯЁІѢ]{3}/.test(m[1]) && !/[а-яё]{2}/.test(m[1]);
};
const titleName = (name: string) =>
  name
    .replace(/[.\s]+$/, '')
    .toLowerCase()
    .replace(/(^|[\s\-])([а-яёa-z])/g, (_, sep, c) => sep + c.toUpperCase());

/**
 * Each page's lines, built from the text items: the edition letter-spaces names in capitals
 * ("О Д И Н Ъ"), which come out as one item each with the word gaps as items of their own,
 * so spaces inside an item are closed up and the gaps between items kept
 */
async function pageLines(url: string): Promise<string[]> {
  const pdf = await pdfDocument(url);
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const { items } = await (await pdf.getPage(n)).getTextContent();
    let line = '';
    const lines: string[] = [];
    for (const item of items as { str: string; hasEOL?: boolean }[]) {
      line += /^(\S ){2,}\S?[.,]?$/.test(item.str) ? item.str.replace(/ (?=\S)/g, '') : item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = '';
      }
    }
    lines.push(line);
    pages.push(lines.join('\n'));
  }
  return pages;
}

export async function planPlay(cfg: PlayConfig): Promise<{ translations: PlayTranslation[]; unusedCorrections: string[] }> {
  const pages = await pageLines(cfg.url);
  const used = new Set<number>();

  const workLines = (from: { page: number; at: string }, to: { page: number; at: string } | null): string[] => {
    const out: string[] = [];
    for (let p = from.page; p <= (to ? to.page : cfg.lastPage); p++) {
      let lines = (pages[p] ?? '').split('\n').map((l) => l.trim());
      if (p === from.page) {
        const i = lines.findIndex((l) => l.includes(from.at));
        if (i < 0) throw new Error(`Page ${p}: "${from.at}" not found`);
        lines = lines.slice(i);
      }
      if (to && p === to.page) {
        const i = lines.findIndex((l) => l.includes(to.at));
        if (i < 0) throw new Error(`Page ${p}: "${to.at}" not found`);
        lines = lines.slice(0, i);
      }
      for (const line of lines) {
        if (!line) continue;
        // Page numbers (often misread: "1 і>7", "184")
        if (line.length <= 7 && /\d/.test(line) && !/[а-яё]{2}/i.test(line)) continue;
        // Footnotes at the page foot
        if (/^\(\s*\*\s*\)/.test(line)) break;
        const clean = line.replace(/\s*\(\s*\*\s*\)/g, '');
        // A speaker's name the layout ran onto the end of the line above ("…собственность ! КАРАМАЛИ.")
        const tail = clean.match(/^(.*[.!?…»)])\s+([А-ЯЁІѢ][А-ЯЁІѢ\-]{2,}(?:\s[А-ЯЁІѢ\-]{2,})*\.)$/);
        if (tail) out.push(tail[1], tail[2]);
        else out.push(clean);
      }
    }
    return out;
  };

  const translations = cfg.parts.map((part, i) => {
    let lines = workLines(part, cfg.parts[i + 1] ?? null);
    const paragraphs: string[] = [];
    if (part.cast) {
      const act = lines.findIndex((l) => ACT.test(l));
      const cast = act < 0 ? lines : lines.slice(0, act);
      paragraphs.push(cast.join('\n'));
      lines = act < 0 ? [] : lines.slice(act);
    }
    let current = '';
    let direction = false;
    const push = () => {
      if (current.trim()) paragraphs.push(current.replace(/\s+/g, ' ').trim());
      current = '';
      direction = false;
    };
    const append = (text: string) => {
      current = current.endsWith('-') ? current.slice(0, -1) + text : current ? `${current} ${text}` : text;
    };
    for (const line of lines) {
      const act = line.match(ACT);
      if (act) {
        push();
        paragraphs.push(`ДЕЙСТВИЕ ${act[1]}`);
        continue;
      }
      if (isSpeaker(line) && !direction) {
        push();
        const m = line.match(SPEAKER)!;
        current = `${titleName(m[1])}${m[2] ? ` ${m[2]}` : ''}:`;
        continue;
      }
      if (line.startsWith('(') && !direction) {
        // A stage direction of its own, between speeches
        if (!current.endsWith(':')) push();
        else {
          append(line);
          if (!/\)\.?$/.test(line)) direction = true;
          continue;
        }
        current = line;
        direction = !/\)\.?$/.test(line);
        if (!direction) push();
        continue;
      }
      append(line);
      if (direction && /\)\.?$/.test(line)) {
        direction = false;
        if (current.startsWith('(')) push();
      }
    }
    push();

    const proofread = path.join(PROOFREAD_DIR, cfg.id, `${part.workSlug}.txt`);
    if (fs.existsSync(proofread)) {
      const body = fs.readFileSync(proofread, 'utf-8').trim();
      return { workSlug: part.workSlug, paragraphs: body.split(/\n\n+/).length, opening: body.slice(0, 120), body, proofread: true };
    }
    let body = paragraphs.map((p) => modernise(fixMixedScript(p))).join('\n\n');
    (cfg.corrections ?? []).forEach((c, k) => {
      const next = 'from' in c ? body.split(c.from).join(c.to) : body.replace(new RegExp(c.pattern, c.flags ?? 'g'), c.to);
      if (next !== body) used.add(k);
      body = next;
    });
    return { workSlug: part.workSlug, paragraphs: paragraphs.length, opening: body.slice(0, 120), body, proofread: false };
  });

  const unusedCorrections = (cfg.corrections ?? [])
    .filter((_, k) => !used.has(k))
    .map((c) => ('from' in c ? c.from : `/${c.pattern}/`));
  return { translations, unusedCorrections };
}
