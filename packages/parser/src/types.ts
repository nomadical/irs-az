// ── Enum constant arrays (matching Prisma schema exactly) ──

export const LANGUAGES = [
  'AZ_LATIN',
  'AZ_ARABIC',
  'AZ_CYRILLIC',
  'FA',
  'AR',
  'RU',
  'EN',
  'TR',
] as const;
export type Language = (typeof LANGUAGES)[number];

export const GENRES = [
  'POEM',
  'PROSE',
  'PLAY',
  'ESSAY',
  'PHILOSOPHY',
  'LETTER',
  'MEMOIR',
] as const;
export type Genre = (typeof GENRES)[number];

export const POEM_FORMS = [
  'GHAZAL',
  'MASNAVI',
  'RUBAI',
  'QASIDA',
  'MURABBA',
  'FREE_VERSE',
  'OTHER',
] as const;
export type PoemForm = (typeof POEM_FORMS)[number];

export const AUTHOR_TYPES = [
  'POET',
  'WRITER',
  'PHILOSOPHER',
  'PLAYWRIGHT',
  'CRITIC',
] as const;
export type AuthorType = (typeof AUTHOR_TYPES)[number];

export const TRANSLATION_TYPES = [
  'TRANSLATION',
  'TRANSLITERATION',
  'MODERNIZATION',
] as const;
export type TranslationType = (typeof TRANSLATION_TYPES)[number];

export const PUBLISH_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

export const SCRIPT_DIRECTIONS = ['LTR', 'RTL'] as const;
export type ScriptDirection = (typeof SCRIPT_DIRECTIONS)[number];

// ── Frontmatter interfaces (what gets written to .md files) ──

export interface AuthorFrontmatter {
  slug: string;
  nameAz: string;
  nameRu?: string;
  nameFa?: string;
  nameEn?: string;
  bornYear?: number;
  bornYearApprox?: boolean;
  diedYear?: number;
  diedYearApprox?: boolean;
  bornPlace?: string;
  diedPlace?: string;
  type: AuthorType;
  period?: string;
  writingLangs: Language[];
  portraitUrl?: string;
  portraitSource?: string;
  portraitCredit?: string;
  status: PublishStatus;
}

export interface CollectionFrontmatter {
  slug: string;
  titleAz: string;
  titleRu?: string;
  titleFa?: string;
  titleEn?: string;
  authorSlug: string;
  year?: number;
  yearApprox?: boolean;
  originalLang: Language;
  genre: Genre;
  order?: number;
  status: PublishStatus;
}

export interface WorkFrontmatter {
  slug: string;
  /** Stable source key (e.g. "ganjoor-27775"); the importer matches on it so slugs can change */
  sourceId?: string;
  titleAz: string;
  titleRu?: string;
  titleFa?: string;
  titleEn?: string;
  authorSlug: string;
  collectionSlug?: string;
  originalLang: Language;
  scriptDirection: ScriptDirection;
  genre: Genre;
  form?: PoemForm;
  year?: number;
  yearApprox?: boolean;
  order?: number;
  sourceNote?: string;
  /** Slugs of works this one replaced; the importer adds them so their URLs redirect here */
  previousSlugs?: string[];
  /** Why the work must stay a draft; the importer never publishes it, even with --publish */
  hold?: string;
  status: PublishStatus;
}

export interface TranslationFrontmatter {
  workSlug: string;
  language: Language;
  type: TranslationType;
  scriptDirection: ScriptDirection;
  translator?: string;
  translatorNote?: string;
  year?: number;
  sourceNote?: string;
  isDefault?: boolean;
  status: PublishStatus;
}

export interface ArtworkFrontmatter {
  sourceId: string;
  title: string;
  authorSlug: string;
  collectionSlug?: string;
  workSlug?: string;
  objectDate?: string;
  yearStart?: number;
  yearEnd?: number;
  medium?: string;
  artists?: string;
  imageUrl: string;
  imageSmallUrl?: string;
  additionalImages?: string[];
  museum: string;
  sourceUrl: string;
  creditLine?: string;
  license: string;
  order?: number;
  status: PublishStatus;
}

// ── Scraped data interfaces ──

export interface ScrapedAuthor {
  nameAz: string;
  nameRu?: string;
  nameFa?: string;
  nameEn?: string;
  bornYear?: number;
  bornYearApprox?: boolean;
  diedYear?: number;
  diedYearApprox?: boolean;
  bornPlace?: string;
  diedPlace?: string;
  type: AuthorType;
  period?: string;
  writingLangs: Language[];
  bioAz?: string;
  bioRu?: string;
  portraitUrl?: string;
  portraitSource?: string;
}

export interface ScrapedWork {
  title: string;
  body: string;
  lang: Language;
  sourceUrl: string;
  categories?: string[];
  form?: PoemForm;
}

export interface ScrapedTranslation {
  workSlug: string;
  body: string;
  language: Language;
  type: TranslationType;
  scriptDirection: ScriptDirection;
  translator?: string;
  sourceNote?: string;
}

// ── Author config (JSON manifest) ──

export interface AuthorConfig {
  slug: string;
  nameAz: string;
  nameRu?: string;
  nameFa?: string;
  nameEn?: string;
  type: AuthorType;
  period?: string;
  writingLangs: Language[];
  skipSources?: string[]; // sourceIds of pages that repeat another work; scrapers don't write them
  wikipedia?: {
    az?: string; // AZ Wikipedia page title
    ru?: string; // RU Wikipedia page title
    en?: string; // EN Wikipedia page title
  };
  wikisource?: {
    az?: string; // AZ Wikisource author page
    ru?: string; // RU Wikisource author page
    az_collection?: string; // target collection slug for AZ Wikisource works
    az_collections?: Record<string, string>; // AZ page title or author-page heading → collection slug
    /**
     * Pages the author page doesn't link: AZ page title → collection slug, or, for a page of
     * several poems, how to cut it: at a separator line ("***") or before each poem's first line,
     * optionally regrouping lines into stanzas of `stanza` lines
     */
    az_extra?: Record<
      string,
      string | { collection: string; separator?: string; starts?: string[]; stanza?: number; form?: PoemForm }
    >;
    ru_collection?: string; // target collection slug for RU Wikisource works
  };
  met?: {
    names: string[]; // how the Met credits the author (role "Author" or "Poet"), e.g. "Nizami"
    queries: string[]; // searches that gather candidates; the credit decides what is kept
    collections?: { match: string; collection: string }[]; // title regex → collection slug
  };
  commons?: {
    roots: { category: string; depth?: number; collection?: string }[]; // walked for files; collection = default
    exclude?: string; // categories to skip (regex), e.g. the Met's and Walters' manuscripts
    earliest?: number; // years before this in a file's date are Hijri dates or shelfmarks, not the copy's year
    poems?: { category: string; match: string; collection: string }[]; // poem category or title keywords → collection; "" = author only
  };
  walters?: {
    manuscripts: string[]; // Digital Walters ids, e.g. "W610"
    poems: { match: string; collection: string }[]; // poem name (diacritics off) → collection slug; "" = author only
  };
  ganjoor?: {
    poetUrl?: string; // e.g. "https://ganjoor.net/fuzuli"
    poetId?: number; // Ganjoor poet ID for API calls
    autoDiscover?: boolean; // auto-discover leaf collections from API
    collections?: {
      catUrl: string; // e.g. "https://ganjoor.net/fuzuli/divan-fa/ghazal-fa"
      collectionSlug: string;
      form?: PoemForm;
    }[];
  };
  collections?: {
    slug: string;
    titleAz: string;
    titleRu?: string;
    titleFa?: string;
    genre: Genre;
    originalLang: Language;
    year?: number;
  }[];
}
