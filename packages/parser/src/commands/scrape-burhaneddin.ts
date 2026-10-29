import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthorConfig, PoemForm } from '../types';
import { shortSlug } from '../scrapers/wikisource-az';
import { writeWorkMd } from '../writers/md-writer';

const DATA_DIR = path.resolve(__dirname, '../../data');
const AUTHOR = 'burhaneddin';
const SOURCE_FILE = path.join(DATA_DIR, 'proofread/burhaneddin-divan-sanal-kitap.txt');
const SOURCE_URL = 'https://archive.org/details/KadBurhaneddinDivan';

/**
 * Kadı Burhaneddin's divan as a Latin-script transcription of the Old Anatolian Turkic text
 * (Sanal-Kitap.com, archived on archive.org as KadBurhaneddinDivan; the numbering G 1–1319,
 * R 1320–1339, T 1327–1457 follows the printed edition, Ergin 1980 as far as we can tell).
 * Every couplet is introduced by a marker line «K.Burhaneddin G 14/3»; the poem is the text under
 * «G 14» and «G 14/1» … «G 14/n».
 *
 * The 39 poems the site already has from az.wikisource (Səfərli's AZ spelling) are listed in the
 * author's skipSources as «ergin-G-14» etc.
 */
const COLLECTIONS = {
  G: { slug: 'burhaneddin-qezeller', form: 'GHAZAL' as PoemForm | undefined, stanza: 2 },
  R: { slug: 'burhaneddin-rubailer', form: 'RUBAI' as PoemForm | undefined, stanza: 4 },
  T: { slug: 'burhaneddin-tuyuglar', form: undefined as PoemForm | undefined, stanza: 4 },
};
type Kind = keyof typeof COLLECTIONS;

const clean = (l: string) =>
  l.replace(/\s+/g, ' ')
    .replace(/\s*\(krş\.[^)]*\)/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();

const FOOTER = (l: string) => /Sanal-Kitap|okuyabilirsiniz|^The End$|^\(Küt/.test(l);

interface Poem { kind: Kind; n: number; lines: string[]; blocks: string[][] }

export function parseDivan(raw: string): Poem[] {
  const parts = raw.split(/^K\.Burhaneddin\s+([GTR])\s+(\d+)(?:\/(\d+))?\s*$/m);
  const poems = new Map<string, Poem>();
  for (let i = 1; i < parts.length; i += 4) {
    const kind = parts[i] as Kind;
    const n = Number(parts[i + 1]);
    const lines = parts[i + 3].split('\n').map(clean).filter((l) => l && !FOOTER(l));
    const key = `${kind}-${n}`;
    if (!poems.has(key)) poems.set(key, { kind, n, lines: [], blocks: [] });
    if (lines.length) poems.get(key)!.blocks.push(lines);
  }
  for (const p of poems.values()) {
    const want = COLLECTIONS[p.kind].stanza;
    // A long hemistich the printed page wrapped: its last word(s) stand alone in the next line
    const merged: string[][] = p.blocks.map((b) => {
      const out: string[] = [];
      for (const l of b) {
        const short = l.split(' ').length <= 2 && /^\p{Ll}/u.test(l);
        if (short && out.length && (b.length > want || b.length % 2 === 1)) out[out.length - 1] += ' ' + l;
        else out.push(l);
      }
      return out;
    });
    p.blocks = merged;
    p.lines = merged.flat();
  }
  return [...poems.values()];
}

export const scrapeBurhaneddinCommand = new Command('scrape-burhaneddin')
  .description("Kadı Burhaneddin's divan (data/proofread/burhaneddin-divan-sanal-kitap.txt) minus poems already on the site")
  .option('--dry-run', 'Print the plan without writing files')
  .action((opts: { dryRun?: boolean }) => {
    const cfg = (JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config/authors.json'), 'utf-8')) as AuthorConfig[])
      .find((a) => a.slug === AUTHOR);
    if (!cfg) throw new Error(`No "${AUTHOR}" entry in authors.json`);
    const skip = new Set(cfg.skipSources ?? []);
    const poems = parseDivan(fs.readFileSync(SOURCE_FILE, 'utf-8'));

    // Slugs and orders continue after the wikisource files of the same collection
    const existing = new Map<Kind, { slugs: Set<string>; order: number }>();
    for (const k of Object.keys(COLLECTIONS) as Kind[]) {
      const dir = path.join(DATA_DIR, 'works', AUTHOR, COLLECTIONS[k].slug);
      const ex = { slugs: new Set<string>(), order: 0 };
      if (fs.existsSync(dir)) {
        for (const f of fs.readdirSync(dir)) {
          // Files this command wrote earlier are rewritten, so they hold no slug and no order
          if (/^sourceId: ergin-/m.test(fs.readFileSync(path.join(dir, f), 'utf-8'))) continue;
          ex.slugs.add(f.replace(/^\d+-/, '').replace(/\.md$/, ''));
          ex.order = Math.max(ex.order, Number(f.match(/^(\d+)-/)?.[1] ?? 0));
        }
      }
      existing.set(k, ex);
    }

    const counts: Record<string, number> = {};
    let skipped = 0;
    let odd = 0;
    for (const p of poems) {
      const sourceId = `ergin-${p.kind}-${p.n}`;
      if (skip.has(sourceId)) { skipped++; continue; }
      if (!p.lines.length) { console.log(`    empty ${sourceId}`); continue; }
      const c = COLLECTIONS[p.kind];
      const ex = existing.get(p.kind)!;
      const title = p.lines[0].replace(/[,.;:!?]+$/, '');
      const base = shortSlug(`${AUTHOR}-${title}`);
      let slug = base;
      for (let i = 2; ex.slugs.has(slug); i++) slug = `${base}-${i}`;
      ex.slugs.add(slug);
      ex.order++;
      counts[p.kind] = (counts[p.kind] ?? 0) + 1;
      if (p.lines.length % c.stanza) odd++;
      const body = [];
      for (let i = 0; i < p.lines.length; i += c.stanza) body.push(p.lines.slice(i, i + c.stanza).join('\n'));
      if (!opts.dryRun) {
        writeWorkMd({
          slug, sourceId, titleAz: title, authorSlug: AUTHOR, collectionSlug: c.slug,
          originalLang: 'AZ_LATIN', scriptDirection: 'LTR', genre: 'POEM', form: c.form, order: ex.order,
          sourceNote: `Divan, ${p.kind} ${p.n}: Latin-script transcription of the Old Anatolian Turkic text (Sanal-Kitap.com) ${SOURCE_URL}`,
          status: 'DRAFT',
        }, body.join('\n\n'));
      }
    }
    console.log(`  ${JSON.stringify(counts)} written, ${skipped} skipped (already on the site), ${odd} with an odd line count`);
  });
