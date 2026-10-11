import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const RAW_DIR = path.resolve(__dirname, '../../data/raw');
const DELAY_MS = 600;
const USER_AGENT = 'IRS-AZ-Parser/1.0 (https://irs.az; educational project)';

let lastRequestTime = 0;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function cacheKey(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex');
}

function cachePath(url: string): string {
  return path.join(RAW_DIR, `${cacheKey(url)}.html`);
}

async function politeDelay() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < DELAY_MS) {
    await new Promise((r) => setTimeout(r, DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export async function cachedGet(url: string): Promise<string> {
  ensureDir(RAW_DIR);
  const cached = cachePath(url);

  if (fs.existsSync(cached)) {
    return fs.readFileSync(cached, 'utf-8');
  }

  await politeDelay();
  console.log(`  GET ${url}`);

  const resp = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 30_000,
    responseType: 'text',
  });

  const body = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
  fs.writeFileSync(cached, body, 'utf-8');
  return body;
}

export async function cachedGetJson<T = unknown>(url: string): Promise<T> {
  const raw = await cachedGet(url);
  return JSON.parse(raw) as T;
}

/** Fetch parsed HTML from MediaWiki action=parse API */
export async function mediawikiParse(
  site: string,
  title: string,
): Promise<{ title: string; text: string; wikitext: string }> {
  const url = `https://${site}/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text|wikitext&format=json&formatversion=2`;
  const data = await cachedGetJson<{ parse: { title: string; text: string; wikitext: string } }>(url);
  return data.parse;
}

/** Generic MediaWiki API call */
export async function mediawikiApi<T = unknown>(
  site: string,
  params: Record<string, string>,
): Promise<T> {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  const url = `https://${site}/w/api.php?${qs.toString()}`;
  return cachedGetJson<T>(url);
}

/** Clear the raw cache */
export function clearCache() {
  if (fs.existsSync(RAW_DIR)) {
    for (const f of fs.readdirSync(RAW_DIR)) {
      fs.unlinkSync(path.join(RAW_DIR, f));
    }
  }
}
