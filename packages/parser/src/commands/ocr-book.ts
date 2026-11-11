import { Command } from 'commander';
import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const DATA_DIR = path.resolve(__dirname, '../../data');
// Tesseract's most accurate models; data/raw is git-ignored
const TESSDATA = path.join(DATA_DIR, 'raw/tessdata');
const MODEL_URL = (lang: string) => `https://github.com/tesseract-ocr/tessdata_best/raw/main/${lang}.traineddata`;

interface Line {
  text: string;
  left: number;
  right: number;
  top: number;
  height: number;
}

interface Page {
  lines: Line[];
  width: number;
}

const has = (cmd: string) => spawnSync('which', [cmd]).status === 0;

/** Azerbaijani Cyrillic (1939–1991) books are read with Tesseract's Russian model, which knows the
    typefaces far better than aze_cyrl does (that one reads ш as п and ғ as р on 1960s–70s print).
    The Russian model has no ә ө ү ҝ ҹ ј һ ғ, so it writes the nearest Russian letter: э for ә,
    у for both у and ү, о for о and ө, е for е and ө, к for к and ҝ, г for г and ғ, ч for ч and ҹ,
    б/в/ь for һ and ) } ] for ј. Each word is expanded over those alternatives and the reading that is
    a known word on the site wins; unknown words take the plain letter, with ü/ö by vowel harmony and
    ğ after a vowel. Set when --lang is aze_cyrl */
function ensureModel(lang: string) {
  const file = path.join(TESSDATA, `${lang}.traineddata`);
  if (fs.existsSync(file)) return;
  fs.mkdirSync(TESSDATA, { recursive: true });
  console.log(`Downloading ${lang} model…`);
  execFileSync('curl', ['-sSfL', '-o', file, MODEL_URL(lang)]);
}

let CYRILLIC = false;
let FREQ = new Map<string, number>();
const KNOWN = 3;
const CYR: Record<string, string> = {
  а: 'a', б: 'bh', в: 'vhğ', г: 'qğ', д: 'd', е: 'eö', ё: 'ö', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'kg', л: 'l',
  м: 'm', н: 'n', о: 'oö', п: 'p', р: 'r', с: 's', т: 't', у: 'uü', ф: 'f', х: 'x', ц: 'c', ч: 'çc', ш: 'ş',
  щ: 'ş', ъ: '', ы: 'ı', ь: 'h', э: 'ə', ю: 'ü', я: 'ya',
  ә: 'ə', ө: 'ö', ү: 'ü', ҝ: 'g', ҹ: 'c', ј: 'y', һ: 'h', ғ: 'ğ', ӱ: 'ü', h: 'h', j: 'y', '©': 'ö',
};
const AMBIGUOUS = new Set('бвгекоуч');
/** Marks the Russian model makes of ј inside a word */
const VOWELS = new Set('aəeıioöuü');
const FRONT = new Set('əeiöü');

/** The Latin readings a Russian-model word can stand for; a first letter Л before a vowel may be Ј */
function readings(word: string): string[] {
  const options: string[][] = [];
  const lower = word.replace(/эа/g, 'э').toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    const o = CYR[ch] ?? ch;
    if (!o) continue;
    if (i === 0 && /[лз]/.test(ch) && /^[аеэоуыи]/.test(lower.slice(1))) options.push([o, 'y']);
    else if (ch === 'к') options.push(['k', 'g', 'h']);
    else options.push(AMBIGUOUS.has(ch) ? [...o] : [o]);
  }
  let out = [''];
  for (const o of options) {
    if (out.length * o.length > 4096) out = out.map((w) => w + o[0]);
    else out = out.flatMap((w) => o.map((c) => w + c));
  }
  return out;
}

/** The plain reading of an unknown word: u/o or ü/ö by the other vowels, ğ after a vowel */
function plainReading(word: string): string {
  const lower = word.replace(/эа/g, 'э').toLowerCase();
  let out = '';
  for (const ch of lower) {
    const o = CYR[ch] ?? ch;
    if (!o) continue;
    const prev = out[out.length - 1];
    if (ch === 'г' && prev && VOWELS.has(prev)) out += 'ğ';
    else out += o[0];
  }
  const vowels = [...out].filter((c) => VOWELS.has(c));
  const front = vowels.filter((c) => FRONT.has(c)).length;
  if (front > vowels.length - front) out = out.replace(/u/g, 'ü').replace(/o/g, 'ö');
  return out;
}

// A Latin H is the model's reading of a small һ, not a capital
const recase = (model: string, fixed: string) =>
  model[0] !== 'H' && model[0] === model[0].toLocaleUpperCase('az') && model[0] !== model[0].toLocaleLowerCase('az')
    ? fixed[0].toLocaleUpperCase('az') + fixed.slice(1)
    : fixed;

/** A Russian-model word as Azerbaijani Latin, by the site's word list; each letter run of a
    hyphenated word (бир-бири) is resolved on its own */
function fromCyrillic(word: string, freq: Map<string, number>, prev = ''): string {
  // ј comes out as ) } ] / \\ 1 — glue those back into the word; the apostrophe of мәʼлум-type words goes
  const cleaned = word
    .replace(/(?<=\p{L})[’'`ʼ°"](?=\p{L})/gu, '')
    .replace(/^[)}\]\/\\1]+(?=\p{L})/u, (m) => 'ј'.repeat(m.length))
    .replace(/(?<=\p{L})[)}\]\/\\1]+(?=\p{L})/gu, (m) => 'ј'.repeat(m.length));
  return cleaned.replace(/\p{L}+/gu, (core) => {
    let best = '';
    let bestN = 0;
    for (const r of readings(core)) {
      const n = freq.get(r) ?? 0;
      if (n > bestN) [best, bestN] = [r, n];
    }
    const latin = bestN >= KNOWN ? best : secondReading(plainReading(core), freq);
    if (!latin) return core;
    // һ is read as a capital Б/В/Ь: that is a capital only at the start of a sentence (or of a line, for a rare word)
    if (latin[0] === 'h' && /^[БВЬ]/.test(core)) {
      const sentenceStart = prev ? /[.!?…:»"”]$/.test(prev) : (freq.get(latin) ?? 0) < 200;
      return sentenceStart ? latin[0].toLocaleUpperCase('az') + latin.slice(1) : latin;
    }
    return recase(core, latin);
  });
}

/** For a word still unknown: the model also reads ә as о, е or а, and и/н for each other.
    Tried only now, so that real pairs like on/ən or at/ət are never swapped */
function secondReading(latin: string, freq: Map<string, number>): string {
  const spots = [...latin].map((c, i) => ({ c, i })).filter(({ c }) => 'oeaöni'.includes(c)).slice(0, 7);
  let best = latin;
  let bestN = 0;
  const alt = (c: string) => (c === 'n' ? 'i' : c === 'i' ? 'n' : 'ə');
  for (let mask = 1; mask < 1 << spots.length; mask++) {
    const chars = [...latin];
    spots.forEach(({ c, i }, k) => {
      if (mask & (1 << k)) chars[i] = alt(c);
    });
    const w = chars.join('');
    const n = freq.get(w) ?? 0;
    if (n > bestN) [best, bestN] = [w, n];
  }
  return bestN >= KNOWN ? best : latin;
}

function imageSize(file: string) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf-8' });
  return { w: Number(out.match(/pixelWidth: (\d+)/)![1]), h: Number(out.match(/pixelHeight: (\d+)/)![1]) };
}

/** Finds the gutter of a spread (the dark fold, or the middle) and writes the two pages, each trimmed
    by a sliver at the outer edge and at the gutter. Needs python3 with Pillow */
const SPLIT_PY = `
import sys
from PIL import Image
src, out0, out1 = sys.argv[1:4]
im = Image.open(src).convert('L')
w, h = im.size
# ink per column: the fold shadow and scanner borders are dark over most of the height, text only a little
small = im.resize((w, 256), Image.BOX)
cols = [sum(1 for y in range(256) if small.getpixel((x, y)) < 120) for x in range(w)]
shadow = lambda x: cols[x] > 90
text = lambda x: 2 < cols[x] <= 90
gutter = min(range(int(w * 0.42), int(w * 0.58)), key=lambda x: small.getpixel((x, 128)))
if not shadow(gutter) and small.getpixel((gutter, 128)) > 150: gutter = w // 2
def cut(start, step, limit):
    x = start
    while x != limit and shadow(x): x += step
    edge = x + step * (w // 150)
    while x != limit and not text(x): x += step
    return (edge + x) // 2 if (x - edge) * step > 0 else edge
g0 = cut(gutter, -1, int(w * 0.3))
g1 = cut(gutter, 1, int(w * 0.7))
left = cut(0, 1, int(w * 0.2))
right = cut(w - 1, -1, int(w * 0.8))
im.crop((left, 0, g0, h)).save(out0)
im.crop((g1, 0, right, h)).save(out1)
`;
const havePillow = (() => spawnSync('python3', ['-c', 'import PIL'], { stdio: 'ignore' }).status === 0)();

function pageImages(file: string, tmp: string, split: boolean): string[] {
  if (!split) return [file];
  const outs = [0, 1].map((i) => path.join(tmp, `${path.parse(file).name}-${i}.png`));
  if (havePillow) {
    execFileSync('python3', ['-c', SPLIT_PY, file, outs[0], outs[1]], { stdio: 'ignore' });
    return outs;
  }
  if (!has('sips')) return [file];
  const { w, h } = imageSize(file);
  const margin = Math.max(2, Math.round(w * 0.01));
  const half = Math.floor(w / 2);
  outs.forEach((out, i) => {
    const x = i === 0 ? margin : half + margin;
    execFileSync('sips', ['-c', String(h), String(half - 2 * margin), '--cropOffset', '0', String(x), file, '--out', out], { stdio: 'ignore' });
  });
  return outs;
}

/** Tesseract's lines with their boxes, from its TSV output */
function ocrPage(file: string, lang: string, wholeSpread: boolean): Page {
  const tsv = execFileSync(
    'tesseract',
    // The 'tsv' preset lives in the system tessdata, which --tessdata-dir hides: ask for TSV directly
    [file, '-', '-l', lang, '--psm', wholeSpread ? '1' : '6', '--tessdata-dir', TESSDATA, '-c', 'tessedit_create_tsv=1'],
    { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
  );
  const rows = tsv.trim().split('\n').slice(1).map((r) => r.split('\t'));
  const width = Number(rows.find((r) => r[0] === '1')?.[8] ?? 0);
  const byLine = new Map<string, { words: string[]; left: number; right: number; top: number; height: number }>();
  for (const r of rows) {
    if (r[0] !== '5' || !r[11]?.trim()) continue;
    const key = `${r[2]}.${r[3]}.${r[4]}`;
    const [left, top, w, h] = [Number(r[6]), Number(r[7]), Number(r[8]), Number(r[9])];
    // A sliver of fold shadow or scanner border near the image edge reads as a stray glyph
    const stray = w < width * 0.02 && !/\p{L}/u.test(r[11]);
    if (stray && (left <= width * 0.04 || left + w >= width * 0.96)) continue;
    const line = byLine.get(key) ?? { words: [], left, right: left + w, top, height: h };
    line.words.push(r[11]);
    line.left = Math.min(line.left, left);
    line.right = Math.max(line.right, left + w);
    line.height = Math.max(line.height, h);
    byLine.set(key, line);
  }
  const lines = [...byLine.values()].map((l) => ({ ...l, text: (CYRILLIC ? l.words.map((w, k) => fromCyrillic(w, FREQ, l.words[k - 1] ?? '')) : l.words).join(' ') }));
  return { lines, width };
}

/** Word frequencies from the Azerbaijani texts already on the site: the dictionary OCR slips are checked against */
function loadWordlist(exclude?: string): Map<string, number> {
  const freq = new Map<string, number>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.md')) {
        const text = fs.readFileSync(p, 'utf-8');
        if (!/^originalLang: AZ_LATIN$/m.test(text)) continue;
        // Re-reading a book already on the site (to test the OCR): leave its own words out
        if (exclude && text.includes(`sourceId: ${exclude}`)) continue;
        for (const w of text.split('\n---\n').slice(1).join(' ').toLocaleLowerCase('az').match(/\p{L}+/gu) ?? []) {
          freq.set(w, (freq.get(w) ?? 0) + 1);
        }
      }
    }
  };
  walk(path.join(DATA_DIR, 'works'));
  return freq;
}


/** Fix a word only when the OCR reading is unknown and one obvious variant is common:
    ı read as i (and back), ü as u, a closing "!" read as "l". Nothing is ever dropped:
    an unknown word is more often a rare form read right than a common one read wrong */
function fixWord(word: string, freq: Map<string, number>): string {
  const lower = word.toLocaleLowerCase('az');
  if (!/\p{L}/u.test(word) || (freq.get(lower) ?? 0) >= KNOWN) return word;
  const recase = (fixed: string) =>
    word[0] === word[0].toLocaleUpperCase('az') && word[0] !== word[0].toLocaleLowerCase('az')
      ? fixed[0].toLocaleUpperCase('az') + fixed.slice(1)
      : fixed;
  const best = (cands: string[]) =>
    cands.map((c) => [c, freq.get(c) ?? 0] as const).filter(([, n]) => n >= KNOWN).sort((a, b) => b[1] - a[1])[0]?.[0];

  // ı/i: try every single swap
  const swaps: string[] = [];
  for (let i = 0; i < lower.length; i++) {
    const c = lower[i];
    const alt = c === 'i' ? 'ı' : c === 'ı' ? 'i' : c === 'ü' ? 'u' : c === 'u' ? 'ü' : null;
    if (alt) swaps.push(lower.slice(0, i) + alt + lower.slice(i + 1));
  }
  const swapped = best(swaps);
  if (swapped) return recase(swapped);
  // Guillemets come out as letters: «sərdarı» reads "csərdarıp"
  const open = lower.startsWith('c') ? 1 : 0;
  const close = /[pb]$/.test(lower) ? 1 : 0;
  for (const [o, c] of [[open, close], [open, 0], [0, close]]) {
    const core = lower.slice(o, lower.length - c);
    if ((o || c) && core.length > 1 && (freq.get(core) ?? 0) >= KNOWN)
      return (o ? '«' : '') + word.slice(o, word.length - c) + (c ? '»' : '');
  }
  if (lower.endsWith('l') && (freq.get(lower.slice(0, -1)) ?? 0) >= KNOWN) return word.slice(0, -1) + '!';
  return word;
}

const fixLine = (text: string, freq: Map<string, number>) =>
  text.replace(/[\p{L}’']+/gu, (w) => fixWord(w, freq));

/** One spread's text in the data/proofread format: paragraphs split by blank lines,
    hyphenated breaks rejoined, page numbers, running heads and footnotes left out */
function layOut(pages: Page[], runningHeads: Set<string>, footnotes: string[], spread: number, freq: Map<string, number>) {
  const paragraphs: string[] = [];
  let current = '';
  let firstIndented: boolean | null = null;
  let numeral = '';
  const flush = () => {
    if (current.trim()) paragraphs.push(current.trim());
    current = '';
  };
  for (const page of pages) {
    const lines = page.lines.filter((l) => /\p{L}/u.test(l.text) && !/^\W*\d{1,3}\W*$/.test(l.text) && !runningHeads.has(norm(l.text)));
    if (!lines.length) continue;
    // The body margin is where most lines start (a mode, so stray marks and indents don't pull it)
    const bins = new Map<number, number>();
    for (const l of lines) bins.set(Math.round(l.left / (page.width * 0.01)), (bins.get(Math.round(l.left / (page.width * 0.01))) ?? 0) + 1);
    const modeBin = [...bins].sort((a, b) => b[1] - a[1])[0][0];
    const margin = Math.min(...lines.filter((l) => Math.round(l.left / (page.width * 0.01)) === modeBin).map((l) => l.left));
    const rights = lines.map((l) => l.right).sort((a, b) => a - b);
    const rightEdge = rights[Math.floor(rights.length * 0.85)];
    const heights = lines.map((l) => l.height).sort((a, b) => a - b);
    const median = heights[Math.floor(heights.length / 2)];
    const indent = page.width * 0.02;
    // Footnotes: a block in the lower part of the page, after a clear gap, set in smaller type.
    // They are reported for a person to sort out (the author's own notes go back in by hand)
    const pitches = lines.slice(1).map((l, i) => l.top - lines[i].top).sort((a, b) => a - b);
    const pitch = pitches[Math.floor(pitches.length / 2)] ?? median * 1.5;
    let notesFrom = lines.length;
    for (let k = Math.ceil(lines.length * 0.6); k < lines.length; k++) {
      if (lines[k].top - lines[k - 1].top < pitch * 1.8) continue;
      const rest = lines.slice(k).map((l) => l.height).sort((a, b) => a - b);
      const headingLike = lines[k].left - margin > indent && rightEdge - lines[k].right > indent * 2;
      if (rest[Math.floor(rest.length / 2)] < median * 0.88 && !headingLike) notesFrom = k;
      break;
    }
    for (const line of lines.slice(notesFrom)) footnotes.push(`${spread}: ${line.text}`);
    for (const line of lines.slice(0, notesFrom)) {
      const indented = line.left - margin > indent;
      const centred = indented && rightEdge - line.right > indent * 2 && line.text.length < 60;
      if (firstIndented === null) firstIndented = indented;
      // A row of asterisks (a section break) reads as "kokok" or "kk"
      if (/^[k*\s]{2,7}$/i.test(line.text)) {
        flush();
        paragraphs.push('* * *');
        continue;
      }
      const text = fixLine(line.text, freq).replace(/^[-—]\s/, '– ');
      // A chapter number on its own line (I, II, …) joins the title under it
      if (centred && /^[IVXL]+\.?$/.test(text)) {
        flush();
        numeral = text.replace(/\.$/, '');
        continue;
      }
      // A heading is centred, starts with a capital and, in a Cyrillic book, was set in capitals (every word recased)
      const letters = text.replace(/\P{L}/gu, '').length;
      if (centred && letters >= 3 && /^\p{Lu}/u.test(text) && !/[.,;:]$/.test(text) && !(CYRILLIC && /(^|[\s-])\p{Ll}/u.test(text))) {
        flush();
        paragraphs.push(`# ${numeral ? `${numeral}. ` : ''}${text}`);
        numeral = '';
        continue;
      }
      numeral = '';
      if (indented || /^–/.test(text)) flush();
      // The Russian model reads a line-end hyphen as »: an unpaired » before a lower-case line is one
      const unpaired = CYRILLIC && current.endsWith('»') && (current.match(/«/g)?.length ?? 0) < (current.match(/»/g)?.length ?? 0);
      if ((current.endsWith('-') || unpaired) && /^\p{Ll}/u.test(text)) current = current.slice(0, -1) + text;
      else current = current ? `${current} ${text}` : text;
    }
    // A page ending mid-sentence runs on to the next page
    if (current && /[.!?…»"”:]$/.test(current)) flush();
  }
  flush();
  return { paragraphs, continues: firstIndented === false };
}

/** A poetry book's spread: every printed line kept as a line, a stanza break where the line gap widens,
    a title set in capitals as "# Title", a year under a poem as "*1970*" (scrape-transcribed reads it) */
function layOutVerse(pages: Page[], runningHeads: Set<string>, freq: Map<string, number>) {
  const out: string[] = [];
  for (const page of pages) {
    const lines = page.lines.filter((l) => !/^\W*\d{1,3}\W*$/.test(l.text) && !runningHeads.has(norm(l.text)) && /[\p{L}\d]/u.test(l.text));
    if (!lines.length) continue;
    const pitches = lines.slice(1).map((l, i) => l.top - lines[i].top).sort((a, b) => a - b);
    const pitch = pitches[Math.floor(pitches.length / 2)] ?? 0;
    lines.forEach((line, k) => {
      if (k && pitch && line.top - lines[k - 1].top > pitch * 1.45 && out.length && out[out.length - 1] !== '') out.push('');
      const text = fixLine(line.text, freq).replace(/^[-—]\s/, '– ');
      const year = text.match(/^\s*\(?(1[89]\d\d(?:\s*[-–]\s*\d{2,4})?)\)?\.?\s*$/);
      if (year) { out.push(`*${year[1].replace(/\s*[-–]\s*/, '–')}*`, ''); return; }
      const letters = text.replace(/\P{L}/gu, '');
      if (letters.length >= 3 && letters === letters.toLocaleUpperCase('az')) {
        if (out.length && out[out.length - 1] !== '') out.push('');
        const title = text.toLocaleLowerCase('az').replace(/^\p{L}/u, (c) => c.toLocaleUpperCase('az'));
        out.push(`# ${title}`, '');
        return;
      }
      out.push(text);
    });
    if (out.length && out[out.length - 1] !== '') out.push('');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const norm = (s: string) => s.toLocaleLowerCase('az').replace(/[^\p{L}]/gu, '');

// ── --engine vlm: a local vision model (mlx-vlm on Apple silicon) reads the pages ──
// On 1960s Cyrillic verse it misreads ~7% of words against a proofread text, against ~22% for the
// Tesseract route above: a better draft, still to be proofread against the scans.
const VLM_MODEL = 'mlx-community/Qwen3-VL-30B-A3B-Instruct-4bit';
const VLM_PYTHON = process.env.OCR_VLM_PYTHON ?? path.join(os.homedir(), '.local/share/irs-local-ocr/bin/python');

/** Azerbaijani Cyrillic (1958 alphabet) to Latin, letter for letter */
const AZ_CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'q', ғ: 'ğ', д: 'd', е: 'e', ә: 'ə', ж: 'j', з: 'z', и: 'i', ы: 'ı', ј: 'y', к: 'k', ҝ: 'g',
  л: 'l', м: 'm', н: 'n', о: 'o', ө: 'ö', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ү: 'ü', ф: 'f', х: 'x', һ: 'h', ч: 'ç',
  ҹ: 'c', ш: 'ş', э: 'e', ю: 'yu', я: 'ya', ц: 'ts', щ: 'şç', ъ: '', ь: '', й: 'y',
};
/** Latin and Russian look-alikes the model mixes into its Cyrillic */
const LOOKALIKE: Record<string, string> = {
  a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', j: 'ј', h: 'һ', i: 'и', k: 'к', s: 'с', g: 'ғ', ə: 'ә', й: 'ј',
};

function cyrillicToLatin(text: string): string {
  let out = '';
  for (const ch of text) {
    const lower = ch.toLocaleLowerCase('az');
    const cyr = LOOKALIKE[lower] ?? lower;
    const latin = AZ_CYR[cyr];
    if (latin === undefined) { out += ch; continue; }
    out += ch !== lower && latin ? latin[0].toLocaleUpperCase('az') + latin.slice(1) : latin;
  }
  return out.replace(/ʼ/g, '’');
}

// Letters this kind of typeface prints alike, weighed even for a known word ("köz" ember / "göz" eye)
const ALIKE: Record<string, string> = { k: 'g', g: 'k', ç: 'c', c: 'ç', a: 'ə', ə: 'a' };
// For an unknown word, more slips are tried
const SLIPS: Record<string, string> = { ...ALIKE, q: 'ğ', ğ: 'q', ı: 'i', i: 'ı', e: 'ə', o: 'ö', ö: 'o', u: 'ü', ü: 'u', h: 'k' };

/** A word swapped for a much more common one that differs only in letters the print or the model confuses */
function resolveAlike(word: string, freq: Map<string, number>): string {
  const lower = word.toLocaleLowerCase('az');
  if (lower.length < 2) return word;
  const known = (freq.get(lower) ?? 0) >= KNOWN;
  const swaps = known ? ALIKE : SLIPS;
  const spots = [...lower].map((c, i) => (swaps[c] ? i : -1)).filter((i) => i >= 0).slice(0, 10);
  let best = lower;
  let bestN = freq.get(lower) ?? 0;
  for (let k = 1; k <= Math.min(3, spots.length) && best === lower; k++) {
    const pick = (start: number, chosen: number[]): void => {
      if (chosen.length === k) {
        const chars = [...lower];
        for (const i of chosen) chars[i] = swaps[chars[i]];
        const cand = chars.join('');
        const n = freq.get(cand) ?? 0;
        if (n > (known ? bestN * 8 + 20 : bestN * 3 + 2)) [best, bestN] = [cand, n];
        return;
      }
      for (let j = start; j < spots.length; j++) pick(j + 1, [...chosen, spots[j]]);
    };
    pick(0, []);
  }
  if (best === lower) return word;
  return [...best].map((c, i) => (word[i] && word[i] !== word[i].toLocaleLowerCase('az') ? c.toLocaleUpperCase('az') : c)).join('');
}

// ── --lang aze_yanalif: the 1922–39 Latin alphabet (y = u, u = ü, j = y, k = q, q = k, g = ğ, ƣ = g, ʒ = ş, ɵ = ö, ь = ı) ──
// The model writes ʒ as z, ƣ as q and ɵ as e often enough that each word is read every way those
// letters allow, with the 1920s spellings (jok, dytyb) mapped to today's (yox, tutub), and the
// reading most common on the site wins. A word the site never has keeps its first reading.
let YANALIF = false;
const YANALIF_LETTERS: Record<string, string[]> = {
  y: ['u'], u: ['ü'], j: ['y'], k: ['q'], q: ['k', 'g'], g: ['ğ', 'g'], ƣ: ['g'], ʒ: ['ş'], з: ['ş'], z: ['z', 'ş'],
  ɵ: ['ö'], e: ['e', 'ö'], ь: ['ı'], ɩ: ['ı'], c: ['c', 'ç'], ç: ['ç', 'c'], b: ['b', 'p'], d: ['d', 't'],
};

function yanalifWord(word: string, freq: Map<string, number>): string {
  const lower = word.toLocaleLowerCase('az');
  let cands = [''];
  [...lower].forEach((ch, i) => {
    let opts = YANALIF_LETTERS[ch] ?? [ch];
    if (ch === 'k' && i === lower.length - 1) opts = ['q', 'x']; // jok → yox
    if (ch === 'd' && i > 0) opts = ['d']; // initial d of the old spelling only (dytyb → tutub)
    if (ch === 'b' && i < lower.length - 1) opts = ['b'];
    const next = cands.flatMap((c) => opts.map((o) => c + o));
    cands = next.length > 2048 ? cands.map((c) => c + opts[0]) : next;
  });
  let best = cands[0];
  let bestN = freq.get(best) ?? 0;
  for (const c of cands) {
    const n = freq.get(c) ?? 0;
    if (n > bestN) [best, bestN] = [c, n];
  }
  return word[0] !== lower[0] ? best[0].toLocaleUpperCase('az') + best.slice(1) : best;
}

function yanalifToLatin(text: string, freq: Map<string, number>): string {
  const n = (w: string) => freq.get(yanalifWord(w, freq).toLocaleLowerCase('az')) ?? 0;
  // A ʒ the model wrote as the digit 3 is read as ʒ; the library's footer and lines of the prompt are dropped
  const letters = text
    .replace(/(?<=\p{L})3|3(?=\p{L})/gu, 'ʒ')
    .replace(/^.*(Universitäts- und Landesbibliothek|urn:nbn:|^DFG$|Latin alphabet|Yanalif).*$/gim, '');
  // Words the model left hyphenated at a line end ("qizi-nin") are joined when the whole is a common word,
  // or when the halves are not both words; doubled words ("belə-belə", "qısıla-qısıla") keep the hyphen
  const joined = letters.replace(/(\p{L}+)-(\p{Ll}+)/gu, (m, a: string, b: string) => {
    if (a.slice(0, 3).toLocaleLowerCase('az') === b.slice(0, 3)) return m;
    if (n(a + b) >= KNOWN) return a + b;
    return n(a) >= KNOWN && n(b) >= KNOWN ? m : a + b;
  });
  return joined.replace(/\p{L}+/gu, (w) => yanalifWord(w, freq)).replace(/[‘ʻ']/g, '’');
}

/** Pages as the model wrote them (blocks split by blank lines, "# " titles, footnotes after "---")
    into the draft's paragraphs; a paragraph broken by the page turn is joined back */
function vlmLayOut(pages: string[], spread: number, footnotes: string[], freq: Map<string, number>) {
  const blocks: string[] = [];
  for (const raw of pages) {
    if (!raw.trim()) continue;
    const [body, notes] = raw.split(/^-{3,}\s*$/m);
    for (const l of (notes ?? '').split('\n')) if (l.trim()) footnotes.push(`${spread}: ${l.trim()}`);
    const fixed = YANALIF
      ? yanalifToLatin(body.replace(/^\[VLM LOOPED.*$/m, (m) => `\n${m}\n`), freq).replace(/\[Vlm Looped[^\]]*\]/i, '[VLM LOOPED – check this page]')
      : (CYRILLIC ? cyrillicToLatin(body) : body).replace(/[\p{L}’']+/gu, (w) => resolveAlike(fixWord(w, freq), freq));
    const pageBlocks = fixed.split(/\n\s*\n/).map((b) => b.trim()).filter((b) => b && /\p{L}/u.test(b));
    const prev = blocks[blocks.length - 1];
    const first = pageBlocks[0];
    // Prose cut at the page turn: the block before has no closing stop and this one starts lower-case
    if (prev && first && !prev.startsWith('# ') && !/[.!?…»"”:]$/.test(prev) && /^\p{Ll}/u.test(first)) {
      blocks[blocks.length - 1] = prev.endsWith('-') ? prev.slice(0, -1) + first : `${prev} ${first}`;
      pageBlocks.shift();
    }
    blocks.push(...pageBlocks);
  }
  // A "title" that runs long or starts lower-case is a paragraph the model marked wrongly
  return blocks.map((b) => (b.startsWith('#') && (b.length > 80 || /^#+\s*\p{Ll}/u.test(b) || b.split(/\s+/).length > 9) ? b.replace(/^#+\s*/, '') : b).replace(/^#\s*/, '# ').replace(/^[-—]\s/gm, '– '));
}

/** The model's raw pages are kept in <draft>.vlm.json; a re-run over the same pages reuses them */
function runVlm(images: string[], lang: string, model: string, tmp: string, cache?: string): Record<string, string> {
  if (!fs.existsSync(VLM_PYTHON)) throw new Error(`No Python with mlx-vlm at ${VLM_PYTHON} (set OCR_VLM_PYTHON); see the ocr-book --engine vlm setup in CLAUDE.md`);
  const out = path.join(tmp, 'vlm.json');
  if (cache && fs.existsSync(cache)) {
    const cached: Record<string, string> = JSON.parse(fs.readFileSync(cache, 'utf-8'));
    const byName = new Map(Object.entries(cached).map(([k, v]) => [path.basename(k), v]));
    if (images.every((i) => byName.has(path.basename(i)))) return Object.fromEntries(images.map((i) => [i, byName.get(path.basename(i))!]));
  }
  const res = spawnSync(VLM_PYTHON, [path.join(__dirname, 'ocr-book-vlm.py'), model, lang, out, ...images], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (res.status !== 0) throw new Error('ocr-book-vlm.py failed');
  const read: Record<string, string> = JSON.parse(fs.readFileSync(out, 'utf-8'));
  if (cache) fs.writeFileSync(cache, JSON.stringify(Object.fromEntries(Object.entries(read).map(([k, v]) => [path.basename(k), v])), null, 1));
  return read;
}

export const ocrBookCommand = new Command('ocr-book')
  .description('Read a scanned book (spread images pNNN.jpg/png) with Tesseract into the data/proofread format, for checking before scrape-transcribed')
  .requiredOption('--images <dir>', 'Folder of spread images named pNNN.jpg or pNNN.png')
  .requiredOption('--out <file>', 'Where to write the draft (a .md file)')
  .option('--from <n>', 'First spread', '1')
  .option('--to <n>', 'Last spread')
  .option('--lang <lang>', 'aze (Latin), aze_cyrl (read with the Russian model, resolved to Latin by the word list) or aze_yanalif (the 1922–39 Latin alphabet; --engine vlm only)', 'aze')
  .option('--single', 'Images are single pages, not two-page spreads')
  .option('--verse', 'A poetry book: keep every printed line, stanza breaks from the line gaps, capitalised titles as headings, years as *1970* (tesseract engine)')
  .option('--engine <engine>', 'tesseract, or vlm: a local vision model via mlx-vlm (Apple silicon; a better draft for Cyrillic books, ~12 s a page)', 'tesseract')
  .option('--vlm-model <id>', 'Hugging Face id of the mlx-vlm model', VLM_MODEL)
  .option('--exclude-source <prefix>', 'Leave works whose sourceId starts with this out of the word list (re-reading a book already on the site)')
  .action((opts: { images: string; out: string; from: string; to?: string; lang: string; single?: boolean; verse?: boolean; engine: string; vlmModel: string; excludeSource?: string }) => {
    CYRILLIC = opts.lang === 'aze_cyrl';
    YANALIF = opts.lang === 'aze_yanalif';
    if (YANALIF && opts.engine !== 'vlm') throw new Error('--lang aze_yanalif needs --engine vlm');
    const vlm = opts.engine === 'vlm';
    if (!vlm && opts.engine !== 'tesseract') throw new Error(`Unknown engine: ${opts.engine}`);
    if (!vlm && !has('tesseract')) throw new Error('tesseract not found: brew install tesseract');
    const tessLang = CYRILLIC ? 'rus' : opts.lang;
    if (!vlm) ensureModel(tessLang);
    const files = fs
      .readdirSync(opts.images)
      .map((f) => ({ f, n: Number(f.match(/^p(\d+)\.(jpe?g|png)$/i)?.[1]) }))
      .filter(({ n }) => n >= Number(opts.from) && (!opts.to || n <= Number(opts.to)))
      .sort((a, b) => a.n - b.n);
    const split = !opts.single;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-book-'));
    const freq = loadWordlist(opts.excludeSource);
    FREQ = freq;

    if (vlm) {
      if (!havePillow) throw new Error('--engine vlm splits spreads with python3 + Pillow: pip install pillow');
      const spreadPages = files.map(({ f, n }) => ({ n, images: pageImages(path.join(opts.images, f), tmp, split) }));
      const text = runVlm(spreadPages.flatMap((s) => s.images), opts.lang, opts.vlmModel, tmp, opts.out.replace(/\.md$/, '') + '.vlm.json');
      const footnotes: string[] = [];
      const out: string[] = [];
      for (const { n, images } of spreadPages) {
        const paragraphs = vlmLayOut(images.map((img) => text[img] ?? ''), n, footnotes, freq);
        out.push(`@@ ${String(n).padStart(3, '0')}`);
        if (paragraphs.length) {
          if (/^\p{Ll}/u.test(paragraphs[0]) && out.length > 1) paragraphs[0] = `>>${paragraphs[0]}`;
          out.push('', paragraphs.join('\n\n'), '');
        }
      }
      fs.writeFileSync(opts.out, out.join('\n').replace(/\n{3,}/g, '\n\n'));
      if (footnotes.length) fs.writeFileSync(opts.out.replace(/\.md$/, '') + '.footnotes.txt', footnotes.join('\n') + '\n');
      fs.rmSync(tmp, { recursive: true, force: true });
      console.log(`Wrote ${opts.out}: ${files.length} spreads (${opts.vlmModel})${footnotes.length ? `, ${footnotes.length} footnote lines set aside` : ''}`);
      return;
    }

    // First pass: read every page, then find running heads (the same short line on many pages)
    const spreads = files.map(({ f, n }) => {
      const images = pageImages(path.join(opts.images, f), tmp, split);
      const pages = images.map((img) => ocrPage(img, tessLang, images.length === 1 && split));
      process.stdout.write(`\r  read spread ${n}`);
      return { n, pages };
    });
    process.stdout.write('\n');
    const counts = new Map<string, number>();
    for (const { pages } of spreads)
      for (const page of pages)
        for (const line of page.lines.slice(0, 2)) {
          const k = norm(line.text);
          if (k.length > 2 && k.length < 40) counts.set(k, (counts.get(k) ?? 0) + 1);
        }
    const runningHeads = new Set([...counts].filter(([, c]) => c >= Math.max(3, spreads.length * 0.2)).map(([k]) => k));

    const footnotes: string[] = [];
    const out: string[] = [];
    for (const { n, pages } of spreads) {
      if (opts.verse) {
        const text = layOutVerse(pages, runningHeads, freq);
        out.push(`@@ ${String(n).padStart(3, '0')}`, ...(text ? ['', text, ''] : []));
        continue;
      }
      const { paragraphs, continues } = layOut(pages, runningHeads, footnotes, n, freq);
      out.push(`@@ ${String(n).padStart(3, '0')}`);
      if (paragraphs.length) {
        if (continues && out.length > 1) paragraphs[0] = `>>${paragraphs[0]}`;
        out.push('', paragraphs.join('\n\n'), '');
      }
    }
    fs.writeFileSync(opts.out, out.join('\n').replace(/\n{3,}/g, '\n\n'));
    if (footnotes.length) fs.writeFileSync(opts.out.replace(/\.md$/, '') + '.footnotes.txt', footnotes.join('\n') + '\n');
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`Wrote ${opts.out}: ${spreads.length} spreads${footnotes.length ? `, ${footnotes.length} footnote lines set aside` : ''}`);
    if (runningHeads.size) console.log(`Running heads dropped: ${[...runningHeads].join(', ')}`);
  });
