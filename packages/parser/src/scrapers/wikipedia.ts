import { mediawikiApi } from '../utils/http';
import { extractInfobox, extractLeadParagraphs } from '../utils/wikitext';
import type { AuthorType, Language, ScrapedAuthor } from '../types';

interface WikiParseResult {
  parse: {
    title: string;
    wikitext: string;
  };
}

async function fetchWikitext(site: string, title: string): Promise<string | null> {
  try {
    const data = await mediawikiApi<WikiParseResult>(site, {
      action: 'parse',
      page: title,
      prop: 'wikitext',
    });
    return data.parse?.wikitext ?? null;
  } catch {
    console.warn(`  Warning: could not fetch ${site}/${title}`);
    return null;
  }
}

function parseYear(raw: string | undefined): { year?: number; approx?: boolean } {
  if (!raw) return {};
  // Handle "təxminən 1494" / "ок. 1494" / "c. 1494"
  const approx = /təxminən|ок\.|circa|c\./i.test(raw);
  const match = raw.match(/(\d{3,4})/);
  if (match) {
    return { year: parseInt(match[1], 10), approx: approx || undefined };
  }
  return {};
}

function inferType(categories: string[], wikitext: string): AuthorType {
  const text = (categories.join(' ') + ' ' + wikitext).toLowerCase();
  if (/filosof|философ|philosopher/i.test(text)) return 'PHILOSOPHER';
  if (/dramaturq|драматург|playwright/i.test(text)) return 'PLAYWRIGHT';
  if (/yazıçı|писатель|writer|novelist|prose/i.test(text)) return 'WRITER';
  if (/tənqidçi|критик|critic/i.test(text)) return 'CRITIC';
  return 'POET';
}

function inferWritingLangs(wikitext: string, categories: string[]): Language[] {
  const text = (categories.join(' ') + ' ' + wikitext).toLowerCase();
  const langs: Language[] = [];

  if (/azərbaycan|azerbaycan|türk/i.test(text)) langs.push('AZ_LATIN');
  if (/fars|persian|فارسی/i.test(text)) langs.push('FA');
  if (/ərəb|arab|عربی/i.test(text)) langs.push('AR');
  if (/osmanlı|ottoman|türkce/i.test(text)) langs.push('AZ_ARABIC');

  return langs.length > 0 ? langs : ['AZ_LATIN'];
}

async function fetchCategories(site: string, title: string): Promise<string[]> {
  try {
    const data = await mediawikiApi<{
      parse: { categories: { category: string }[] };
    }>(site, {
      action: 'parse',
      page: title,
      prop: 'categories',
    });
    return data.parse?.categories?.map((c) => c.category) ?? [];
  } catch {
    return [];
  }
}

export async function scrapeAuthorFromWikipedia(
  nameAz: string,
  nameRu?: string,
): Promise<ScrapedAuthor> {
  console.log(`Scraping Wikipedia for: ${nameAz}`);

  const result: ScrapedAuthor = {
    nameAz,
    nameRu,
    type: 'POET',
    writingLangs: ['AZ_LATIN'],
  };

  // Fetch AZ Wikipedia
  const azWikitext = await fetchWikitext('az.wikipedia.org', nameAz);
  if (azWikitext) {
    const infobox = extractInfobox(azWikitext);
    const categories = await fetchCategories('az.wikipedia.org', nameAz);

    const born = parseYear(infobox['doğum tarixi'] || infobox['birth_date']);
    const died = parseYear(infobox['ölüm tarixi'] || infobox['death_date']);

    result.bornYear = born.year;
    result.bornYearApprox = born.approx;
    result.diedYear = died.year;
    result.diedYearApprox = died.approx;
    result.bornPlace = infobox['doğum yeri'] || infobox['birth_place'];
    result.diedPlace = infobox['ölüm yeri'] || infobox['death_place'];

    result.type = inferType(categories, azWikitext);
    result.writingLangs = inferWritingLangs(azWikitext, categories);

    result.bioAz = extractLeadParagraphs(azWikitext, 2);
  }

  // Fetch RU Wikipedia
  if (nameRu) {
    const ruWikitext = await fetchWikitext('ru.wikipedia.org', nameRu);
    if (ruWikitext) {
      result.bioRu = extractLeadParagraphs(ruWikitext, 2);

      // Fill gaps from RU infobox if AZ didn't have them
      if (!result.bornYear) {
        const infobox = extractInfobox(ruWikitext);
        const born = parseYear(infobox['дата рождения'] || infobox['birth_date']);
        const died = parseYear(infobox['дата смерти'] || infobox['death_date']);
        result.bornYear = born.year;
        result.bornYearApprox = born.approx;
        result.diedYear = died.year;
        result.diedYearApprox = died.approx;
      }
    }
  }

  return result;
}
