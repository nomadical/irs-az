import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './lib/i18n';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  matcher: [
    // Match all paths except /admin, /api, /_next, /static and files with an
    // extension (sitemap.xml, robots.txt, favicons). Slugs never contain dots.
    '/((?!admin|api|_next|static|.*\\..*).*)',
  ],
};
