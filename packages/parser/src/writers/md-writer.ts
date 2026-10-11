import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { slugify } from '../utils/slug';
import type {
  AuthorFrontmatter,
  CollectionFrontmatter,
  WorkFrontmatter,
  TranslationFrontmatter,
} from '../types';

const DATA_DIR = path.resolve(__dirname, '../../data');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Strip undefined values — js-yaml can't serialize them */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function writeMd(filePath: string, frontmatter: Record<string, unknown>, body: string) {
  ensureDir(path.dirname(filePath));
  const content = matter.stringify(body, stripUndefined(frontmatter));
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`  Wrote ${path.relative(DATA_DIR, filePath)}`);
}

/** Write author .md file — body is the AZ bio markdown */
export function writeAuthorMd(
  data: AuthorFrontmatter,
  bioAz: string,
  bioRu?: string,
) {
  const dir = path.join(DATA_DIR, 'authors');
  const filePath = path.join(dir, `${data.slug}.md`);
  const fm: Record<string, unknown> = { ...data };
  if (bioRu) fm.bioRu = bioRu;
  writeMd(filePath, fm, bioAz);
}

/** Write collection .md file */
export function writeCollectionMd(
  data: CollectionFrontmatter,
  description?: string,
) {
  const dir = path.join(DATA_DIR, 'collections', data.authorSlug);
  const filePath = path.join(dir, `${data.slug}.md`);
  writeMd(filePath, { ...data }, description ?? '');
}

/** Write work .md file — body is the work text */
export function writeWorkMd(data: WorkFrontmatter, body: string) {
  const dir = path.join(
    DATA_DIR,
    'works',
    data.authorSlug,
    data.collectionSlug ?? '_standalone',
  );
  const orderPrefix = data.order != null ? String(data.order).padStart(3, '0') + '-' : '';
  const filePath = path.join(dir, `${orderPrefix}${data.slug}.md`);
  writeMd(filePath, { ...data }, body);
}

/** Write translation .md file */
export function writeTranslationMd(data: TranslationFrontmatter, body: string) {
  const dir = path.join(DATA_DIR, 'translations');
  // Translator in the name, so a work can have several translations into one language
  const translator = data.translator ? `.${slugify(data.translator)}` : '';
  const filePath = path.join(dir, `${data.workSlug}.${data.language}.${data.type}${translator}.md`);
  writeMd(filePath, { ...data }, body);
}
