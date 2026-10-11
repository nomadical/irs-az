// ── Enums (mirrored from Prisma for frontend use) ──

export type Language =
  | 'AZ_LATIN'
  | 'AZ_ARABIC'
  | 'AZ_CYRILLIC'
  | 'FA'
  | 'AR'
  | 'RU'
  | 'EN'
  | 'TR';

export type Genre =
  | 'POEM'
  | 'PROSE'
  | 'PLAY'
  | 'ESSAY'
  | 'PHILOSOPHY'
  | 'LETTER'
  | 'MEMOIR';

export type PoemForm =
  | 'GHAZAL'
  | 'MASNAVI'
  | 'RUBAI'
  | 'QASIDA'
  | 'MURABBA'
  | 'FREE_VERSE'
  | 'OTHER';

export type AuthorType =
  | 'POET'
  | 'WRITER'
  | 'PHILOSOPHER'
  | 'PLAYWRIGHT'
  | 'CRITIC';

export type TranslationType =
  | 'TRANSLATION'
  | 'TRANSLITERATION'
  | 'MODERNIZATION';

export type ScriptDirection = 'LTR' | 'RTL';

export type PublishStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

// ── API Response Types ──

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AuthorSummary {
  id: string;
  slug: string;
  nameAz: string;
  nameRu: string | null;
  nameEn: string | null;
  bornYear: number | null;
  bornYearApprox: boolean;
  diedYear: number | null;
  diedYearApprox: boolean;
  type: AuthorType;
  period: string | null;
  portraitUrl: string | null;
  writingLangs: Language[];
  _count: { works: number };
}

export interface AuthorDetail {
  id: string;
  slug: string;
  nameAz: string;
  nameRu: string | null;
  nameFa: string | null;
  nameEn: string | null;
  bornYear: number | null;
  bornYearApprox: boolean;
  diedYear: number | null;
  diedYearApprox: boolean;
  type: AuthorType;
  period: string | null;
  writingLangs: Language[];
  bioAz: string | null;
  bioRu: string | null;
  bioEn: string | null;
  portraitUrl: string | null;
  collections: CollectionWithWorks[];
  works: WorkSummary[]; // standalone works
}

export interface CollectionWithWorks {
  id: string;
  slug: string;
  titleAz: string;
  titleRu: string | null;
  genre: Genre;
  year: number | null;
  works: WorkSummary[];
}

export interface WorkSummary {
  id: string;
  slug: string;
  titleAz: string;
  titleRu: string | null;
  genre: Genre;
  form: PoemForm | null;
  year: number | null;
  yearApprox: boolean;
  order: number | null;
}

export interface WorkDetail {
  id: string;
  slug: string;
  titleAz: string;
  titleRu: string | null;
  titleFa: string | null;
  body: string;
  bodyHtml: string | null;
  originalLang: Language;
  scriptDirection: ScriptDirection;
  genre: Genre;
  form: PoemForm | null;
  year: number | null;
  yearApprox: boolean;
  author: {
    slug: string;
    nameAz: string;
    nameRu: string | null;
    nameEn: string | null;
    portraitUrl: string | null;
  };
  collection: {
    slug: string;
    titleAz: string;
    titleRu: string | null;
  } | null;
  translations: TranslationSummary[];
}

export interface TranslationSummary {
  id: string;
  language: Language;
  type: TranslationType;
  body: string;
  bodyHtml: string | null;
  translator: string | null;
  translatorNote: string | null;
  year: number | null;
  isDefault: boolean;
  scriptDirection: ScriptDirection;
}

export interface WorkNav {
  prev: { slug: string; titleAz: string; titleRu: string | null } | null;
  next: { slug: string; titleAz: string; titleRu: string | null } | null;
}
