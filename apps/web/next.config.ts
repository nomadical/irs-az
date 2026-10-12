import type { NextConfig } from 'next';
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';
import { AUTHOR_FACET_PATTERN, TAG_FACET_PATTERN, WORK_FACET_PATTERN } from './lib/facets';

const withNextIntl = createNextIntlPlugin();

const LOCALE = ':locale(az|ru|en)';

/** /az/works/a/b/c → /az/works?f=a&f=b&f=c, for 1…n facet segments; the page parses them */
function facetRewrites(base: string, pattern: string, max: number) {
  return Array.from({ length: max }, (_, i) => {
    const names = Array.from({ length: i + 1 }, (_, j) => `f${j}`);
    return {
      source: `/${LOCALE}/${base}/${names.map((n) => `:${n}(${pattern})`).join('/')}`,
      destination: `/:locale/${base}?${names.map((n) => `f=:${n}`).join('&')}`,
    };
  });
}

const nextConfig: NextConfig = {
  // Self-contained server for the Docker image (see apps/web/Dockerfile)
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Share-image fonts and page copy are read from disk at runtime
  outputFileTracingIncludes: { '/**': ['./assets/fonts/**', './content/**'] },
  transpilePackages: ['@irs-az/shared'],
  // Readable filter URLs (lib/facets.ts), checked before the [slug] routes they would shadow
  async rewrites() {
    return {
      beforeFiles: [
        ...facetRewrites('works', WORK_FACET_PATTERN, 3),
        ...facetRewrites('authors', AUTHOR_FACET_PATTERN, 2),
        { source: `/${LOCALE}/tags/:slug/:f0(${TAG_FACET_PATTERN})`, destination: '/:locale/tags/:slug?f=:f0' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      // Museum images in the artwork galleries, resized here instead of loaded at full size
      { protocol: 'https', hostname: 'images.metmuseum.org', pathname: '/CRDImages/**' },
      { protocol: 'https', hostname: 'thedigitalwalters.org', pathname: '/Data/WaltersManuscripts/**' },
    ],
  },
};

export default withNextIntl(nextConfig);
