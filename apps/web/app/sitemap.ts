import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';
import { locales } from '@/lib/i18n';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/** One entry per locale, each listing its hreflang siblings. */
function entries(path: string, lastModified?: string): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}${path}`]));
  return locales.map((l) => ({
    url: `${SITE_URL}/${l}${path}`,
    lastModified,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ authors, collections, works, blog }, tags] = await Promise.all([
    api.getSitemap(),
    api.getTags().catch(() => []),
  ]);

  return [
    ...['', '/authors', '/works', '/tags', '/blog', '/about', '/contribute', '/contact'].flatMap((p) => entries(p)),
    ...authors.flatMap((a) => entries(`/authors/${a.slug}`, a.updatedAt)),
    ...collections.flatMap((c) => entries(`/collections/${c.slug}`, c.updatedAt)),
    ...works.flatMap((w) => entries(`/works/${w.slug}`, w.updatedAt)),
    ...blog.flatMap((b) => entries(`/blog/${b.slug}`, b.updatedAt)),
    ...tags.filter((t) => t.works > 0).flatMap((t) => entries(`/tags/${t.slug}`)),
  ];
}
