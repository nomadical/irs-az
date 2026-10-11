import { mediawikiApi } from '../utils/http';
import { wikitextToMarkdown, detectScript } from '../utils/wikitext';
import type { Language, ScrapedWork } from '../types';

interface CategoryMember {
  title: string;
  ns: number;
}

interface CategoryResponse {
  query: {
    categorymembers: CategoryMember[];
  };
  continue?: { cmcontinue: string };
}

/** List pages in a single category (one level) */
async function listCategoryMembers(
  site: string,
  categoryTitle: string,
  cmtype: string,
): Promise<CategoryMember[]> {
  const members: CategoryMember[] = [];
  let cmcontinue: string | undefined;

  do {
    const params: Record<string, string> = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: categoryTitle,
      cmlimit: '200',
      cmtype,
    };
    if (cmcontinue) params.cmcontinue = cmcontinue;

    try {
      const data = await mediawikiApi<CategoryResponse>(site, params);
      members.push(...(data.query?.categorymembers ?? []));
      cmcontinue = data.continue?.cmcontinue;
    } catch {
      break;
    }
  } while (cmcontinue);

  return members;
}

/** Recursively collect all page titles from a category and its subcategories */
async function collectPagesRecursive(
  site: string,
  categoryTitle: string,
  visited: Set<string>,
): Promise<string[]> {
  if (visited.has(categoryTitle)) return [];
  visited.add(categoryTitle);

  const titles: string[] = [];

  // Get pages in this category
  const pages = await listCategoryMembers(site, categoryTitle, 'page');
  for (const p of pages) {
    // Skip author pages (ns=102) and portal pages
    if (p.ns === 102 || p.title.startsWith('Portal:')) continue;
    titles.push(p.title);
  }

  // Get subcategories and recurse
  const subcats = await listCategoryMembers(site, categoryTitle, 'subcat');
  for (const sc of subcats) {
    const subPages = await collectPagesRecursive(site, sc.title, visited);
    titles.push(...subPages);
  }

  return titles;
}

/** List all work pages under an author's Wikisource category, recursively */
export async function listWorksOnWikisource(
  site: string,
  authorPageTitle: string,
): Promise<string[]> {
  const catPrefix = site.startsWith('az.') ? 'Kateqoriya' : 'Категория';
  const categoryTitle = `${catPrefix}:${authorPageTitle}`;

  console.log(`  Searching category: ${categoryTitle}`);
  const visited = new Set<string>();
  const titles = await collectPagesRecursive(site, categoryTitle, visited);

  // Deduplicate
  const unique = [...new Set(titles)];

  // If no category results, try listing subpages as fallback
  if (unique.length === 0) {
    try {
      const data = await mediawikiApi<{
        query: { allpages: { title: string }[] };
      }>(site, {
        action: 'query',
        list: 'allpages',
        apprefix: authorPageTitle + '/',
        aplimit: '200',
      });
      unique.push(...(data.query?.allpages?.map((p) => p.title) ?? []));
    } catch {
      // Nothing found
    }
  }

  console.log(`  Found ${unique.length} pages on ${site} (visited ${visited.size} categories)`);
  return unique;
}

interface ParseResponse {
  parse: {
    title: string;
    wikitext: string;
    categories: { category: string }[];
  };
}

/** Scrape a single work page from Wikisource */
export async function scrapeWork(
  site: string,
  pageTitle: string,
): Promise<ScrapedWork | null> {
  let data: ParseResponse;
  try {
    data = await mediawikiApi<ParseResponse>(site, {
      action: 'parse',
      page: pageTitle,
      prop: 'wikitext|categories',
    });
  } catch {
    console.warn(`  Skipping (fetch failed): ${pageTitle}`);
    return null;
  }

  const wikitext = data.parse?.wikitext;
  if (!wikitext) return null;

  // Skip disambiguation, stub, redirect, and TOC/index pages
  const lower = wikitext.toLowerCase();
  if (
    lower.includes('#redirect') ||
    lower.includes('#yönləndirmə') ||
    lower.includes('#перенаправление') ||
    lower.includes('{{stub') ||
    lower.includes('{{dəqiqləşdirmə') ||
    lower.includes('{{mündəricat')
  ) {
    return null;
  }

  const body = wikitextToMarkdown(wikitext);

  // Skip very short articles (likely stubs or TOC pages)
  if (body.length < 50) return null;

  const categories = data.parse.categories?.map((c) => c.category) ?? [];
  const lang: Language = site.startsWith('az.') ? 'AZ_LATIN' : 'RU';
  const sourceUrl = `https://${site}/wiki/${encodeURIComponent(pageTitle)}`;

  return {
    title: pageTitle.split('/').pop() ?? pageTitle,
    body,
    lang,
    sourceUrl,
    categories,
  };
}
