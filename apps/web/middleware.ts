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

// Slugs from before readable URLs: Ganjoor ids and hand-made ones with non-ASCII letters
const isLegacySlug = (slug: string) => /^ganjoor-\d+$/.test(slug) || /[^\x00-\x7f]/.test(slug);

/**
 * Old work URLs get a real 308 here. The page has its own redirect fallback, but by then
 * the loading boundary has already sent a 200, which crawlers don't treat as a move.
 */
async function redirectLegacyWork(req: NextRequest) {
  const match = req.nextUrl.pathname.match(WORK_PATH);
  if (!match) return null;
  const [, locale, encoded] = match;
  const slug = decodeURIComponent(encoded);
  if (!isLegacySlug(slug)) return null;

  const res = await fetch(`${API_URL}/works/resolve/${encodeURIComponent(slug)}`).catch(() => null);
  if (!res?.ok) return null;
  const { slug: current } = (await res.json()) as { slug: string };
  if (current === slug) return null;

  const target = new URL(`/${locale}/works/${encodeURIComponent(current)}`, process.env.SITE_URL ?? req.url);
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
