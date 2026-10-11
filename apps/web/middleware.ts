import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { locales, defaultLocale } from './lib/i18n';

const intl = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const WORK_PATH = new RegExp(`^/(${locales.join('|')})/works/([^/]+)$`);

// Resolver answers per slug: the current slug, or null when there is no such work.
// Renames are rare, so a few minutes of staleness only delays a new redirect.
const RESOLVE_TTL_MS = 5 * 60_000;
const RESOLVE_CACHE_MAX = 5_000;
const resolved = new Map<string, { current: string | null; expires: number }>();

async function currentSlug(slug: string): Promise<string | null | undefined> {
  const hit = resolved.get(slug);
  if (hit && hit.expires > Date.now()) return hit.current;

  const res = await fetch(`${API_URL}/works/resolve/${encodeURIComponent(slug)}`, {
    signal: AbortSignal.timeout(1_500),
  }).catch(() => null);
  // API down or slow: let the page handle it (it has its own redirect fallback)
  if (!res || (!res.ok && res.status !== 404)) return undefined;
  const current = res.ok ? ((await res.json()) as { slug: string }).slug : null;

  if (resolved.size >= RESOLVE_CACHE_MAX) resolved.delete(resolved.keys().next().value!);
  resolved.set(slug, { current, expires: Date.now() + RESOLVE_TTL_MS });
  return current;
}

/**
 * Old work URLs get a real 308 here. The page has its own redirect fallback, but by then
 * the loading boundary has already sent a 200, which crawlers don't treat as a move.
 * Every work slug is checked: renamed ones can look exactly like current ones.
 */
async function redirectLegacyWork(req: NextRequest) {
  const match = req.nextUrl.pathname.match(WORK_PATH);
  if (!match) return null;
  const [, locale, encoded] = match;
  const slug = decodeURIComponent(encoded);

  const current = await currentSlug(slug);
  if (!current || current === slug) return null;

  const target = new URL(`/${locale}/works/${encodeURIComponent(current)}`, process.env.SITE_URL ?? req.url);
  target.search = req.nextUrl.search; // keep ?tr=<id>
  return NextResponse.redirect(target, 308);
}

export default async function middleware(req: NextRequest) {
  return (await redirectLegacyWork(req)) ?? intl(req);
}

export const config = {
  // Node runtime so API_URL and SITE_URL are read at runtime, not inlined at build
  runtime: 'nodejs',
  matcher: [
    // Match all paths except /admin, /api, /_next, /static and files with an
    // extension (sitemap.xml, robots.txt, favicons). Slugs never contain dots.
    '/((?!admin|api|_next|static|.*\\..*).*)',
  ],
};
