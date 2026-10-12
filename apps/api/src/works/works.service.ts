import { Injectable, NotFoundException } from '@nestjs/common';
import { Language, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkDto } from './dto/create-work.dto';
import { QueryWorksDto } from './dto/query-works.dto';
import { slugify, uniqueSlug } from '../common/utils/slug';
import { renderMarkdown } from '../common/utils/markdown';
import { paginationArgs, paginatedResult } from '../common/utils/pagination';

/**
 * Poems offered by the randomizer and the poem of the day: ones an AZ/RU/EN reader can
 * actually read, i.e. written in Latin-script Azerbaijani or with an Azerbaijani translation.
 */
const READABLE_POEM: Prisma.WorkWhereInput = {
  status: 'PUBLISHED',
  genre: 'POEM',
  OR: [
    { originalLang: 'AZ_LATIN' },
    { translations: { some: { language: 'AZ_LATIN', status: 'PUBLISHED' } } },
  ],
};

/** Calendar day in Baku, the portal's home time zone (YYYY-MM-DD) */
function bakuDate(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Baku' });
}

/** FNV-1a, so every API instance picks the same poem for the same day */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Opening lines of a poem. Some imports put a blank line after every verse, so blanks are skipped. */
function excerpt(body: string, max = 4) {
  return body
    .split('\n')
    .map((line) => line.replace(/^[#>*\s-]+/, '').trim())
    .filter(Boolean)
    .slice(0, max);
}

const UI_LANGUAGE: Record<string, Language> = { az: 'AZ_LATIN', ru: 'RU', en: 'EN' };

/** Fields needed to pick a work's opening lines in a reader's language */
const INCIPIT_SOURCE = (language: Language) =>
  ({
    body: true,
    originalLang: true,
    translations: {
      where: { language, status: 'PUBLISHED' as const },
      orderBy: [{ isDefault: 'desc' as const }, { createdAt: 'asc' as const }],
      take: 1,
      select: { body: true, language: true },
    },
  }) satisfies Prisma.WorkSelect;

/** First two lines in the reader's language when a translation exists, else in the original */
function withIncipit<T extends { body: string; originalLang: Language; translations: { body: string; language: Language }[] }>(
  work: T,
) {
  const { body, translations, ...rest } = work;
  const tr = translations[0];
  return {
    ...rest,
    incipit: { lines: excerpt(tr?.body ?? body, 2), lang: tr?.language ?? work.originalLang },
  };
}

@Injectable()
export class WorksService {
  constructor(private prisma: PrismaService) {}

  private daily: { date: string; work: unknown } | null = null;

  async findAll(query: QueryWorksDto) {
    const { skip, take, page, limit } = paginationArgs(query);

    const where: Prisma.WorkWhereInput = {
      ...(query.all !== 'true' && { status: 'PUBLISHED' }),
      ...(query.genre && { genre: query.genre }),
      ...(query.form && { form: query.form }),
      ...(query.lang && { originalLang: query.lang }),
      ...(query.yearFrom && { year: { gte: query.yearFrom } }),
      ...(query.yearTo && { year: { ...((query.yearFrom && { gte: query.yearFrom }) || {}), lte: query.yearTo } }),
      ...(query.authorSlug && {
        author: { slug: query.authorSlug },
      }),
      ...(query.tag && { tags: { some: { tag: { slug: query.tag }, source: { not: 'REJECTED' } } } }),
      ...(query.q && {
        OR: (['titleAz', 'titleRu', 'titleEn'] as const).map((field) => ({
          [field]: { contains: query.q, mode: 'insensitive' as const },
        })),
      }),
    };

    const incipitLanguage = query.incipit ? UI_LANGUAGE[query.incipit] : undefined;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.work.findMany({
        where,
        skip,
        take,
        orderBy: query.sort === 'recent' ? { createdAt: 'desc' } : { year: 'asc' },
        select: {
          ...(incipitLanguage && INCIPIT_SOURCE(incipitLanguage)),
          id: true,
          slug: true,
          titleAz: true,
          titleRu: true,
          genre: true,
          form: true,
          year: true,
          yearApprox: true,
          originalLang: true,
          status: true,
          author: {
            select: { slug: true, nameAz: true, nameRu: true },
          },
          collection: {
            select: { slug: true, titleAz: true },
          },
        },
      }),
      this.prisma.work.count({ where }),
    ]);

    const rows: object[] = incipitLanguage ? data.map((w) => withIncipit(w as typeof w & Parameters<typeof withIncipit>[0])) : data;
    return paginatedResult(rows, total, page, limit);
  }

  async findById(id: string) {
    const work = await this.prisma.work.findUnique({
      where: { id },
      include: {
        author: { select: { slug: true, nameAz: true } },
        collection: { select: { slug: true, titleAz: true } },
        tags: { select: { source: true, tag: { select: { slug: true } } } },
      },
    });
    if (!work) throw new NotFoundException('Work not found');
    return work;
  }

  /**
   * Editor changes to a work's tags. Adding marks the tag EDITOR (kept by the rules);
   * removing marks it REJECTED, so re-running the keyword rules won't bring it back.
   */
  async setTags(id: string, { add = [], remove = [] }: { add?: string[]; remove?: string[] }) {
    const work = await this.prisma.work.findUnique({ where: { id }, select: { id: true } });
    if (!work) throw new NotFoundException('Work not found');

    const slugs = [...new Set([...add, ...remove])];
    const tags = await this.prisma.tag.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
    const idOf = new Map(tags.map((t) => [t.slug, t.id]));
    const unknown = slugs.filter((s) => !idOf.has(s));
    if (unknown.length) throw new NotFoundException(`Unknown tags: ${unknown.join(', ')}`);

    const upsert = (slug: string, source: 'EDITOR' | 'REJECTED') =>
      this.prisma.workTag.upsert({
        where: { workId_tagId: { workId: id, tagId: idOf.get(slug)! } },
        create: { workId: id, tagId: idOf.get(slug)!, source },
        update: { source },
      });
    await this.prisma.$transaction([
      ...add.map((slug) => upsert(slug, 'EDITOR')),
      ...remove.filter((slug) => !add.includes(slug)).map((slug) => upsert(slug, 'REJECTED')),
    ]);

    return this.prisma.workTag.findMany({
      where: { workId: id },
      select: { source: true, tag: { select: { slug: true } } },
    });
  }

  /** Current slug for a work's current or previous slug, so old URLs can redirect. */
  async resolveSlug(slug: string) {
    const work = await this.prisma.work.findFirst({
      where: { status: 'PUBLISHED', OR: [{ slug }, { previousSlugs: { has: slug } }] },
      select: { slug: true },
    });
    if (!work) throw new NotFoundException('Work not found');
    return work;
  }

  async findBySlug(slug: string) {
    const work = await this.prisma.work.findUnique({
      where: { slug, status: 'PUBLISHED' },
      include: {
        author: {
          select: {
            slug: true,
            nameAz: true,
            nameRu: true,
            nameEn: true,
            portraitUrl: true,
          },
        },
        collection: {
          select: { slug: true, titleAz: true, titleRu: true },
        },
        translations: {
          where: { status: 'PUBLISHED' },
          orderBy: [{ isDefault: 'desc' }, { language: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            language: true,
            type: true,
            body: true,
            bodyHtml: true,
            translator: true,
            translatorNote: true,
            year: true,
            sourceNote: true,
            isDefault: true,
            scriptDirection: true,
          },
        },
        tags: {
          where: { source: { not: 'REJECTED' } },
          orderBy: [{ tag: { kind: 'asc' } }, { tag: { order: 'asc' } }],
          select: { tag: { select: { slug: true, kind: true, nameAz: true, nameRu: true, nameEn: true } } },
        },
      },
    });

    if (!work) throw new NotFoundException('Work not found');

    // Increment view count — fire and forget
    this.prisma.work
      .update({ where: { id: work.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    return work;
  }

  /** The prev/next navigation — most performance-critical query */
  async getNav(slug: string) {
    const work = await this.prisma.work.findUnique({
      where: { slug },
      select: { id: true, collectionId: true, order: true },
    });

    if (!work?.collectionId || work.order == null) {
      return { prev: null, next: null };
    }

    const [prev, next] = await this.prisma.$transaction([
      this.prisma.work.findFirst({
        where: {
          collectionId: work.collectionId,
          order: { lt: work.order },
          status: 'PUBLISHED',
        },
        orderBy: { order: 'desc' },
        select: { slug: true, titleAz: true, titleRu: true },
      }),
      this.prisma.work.findFirst({
        where: {
          collectionId: work.collectionId,
          order: { gt: work.order },
          status: 'PUBLISHED',
        },
        orderBy: { order: 'asc' },
        select: { slug: true, titleAz: true, titleRu: true },
      }),
    ]);

    return { prev, next };
  }

  /** Slug of a random readable poem */
  async random() {
    const count = await this.prisma.work.count({ where: READABLE_POEM });
    if (!count) throw new NotFoundException('No poems yet');
    return this.prisma.work.findFirstOrThrow({
      where: READABLE_POEM,
      orderBy: { id: 'asc' },
      skip: Math.floor(Math.random() * count),
      select: { slug: true },
    });
  }

  /**
   * A handful of other works by the same author, with their opening lines.
   * The pick is stable per work (so the page caches well) but differs between works.
   */
  async moreByAuthor(slug: string, locale = 'az', take = 4) {
    const work = await this.prisma.work.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: { id: true, authorId: true },
    });
    if (!work) throw new NotFoundException('Work not found');

    const where: Prisma.WorkWhereInput = { authorId: work.authorId, status: 'PUBLISHED', id: { not: work.id } };
    const count = await this.prisma.work.count({ where });
    const works = await this.prisma.work.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: count > take ? hash(slug) % (count - take + 1) : 0,
      take,
      select: {
        slug: true,
        titleAz: true,
        titleRu: true,
        titleEn: true,
        genre: true,
        form: true,
        year: true,
        ...INCIPIT_SOURCE(UI_LANGUAGE[locale] ?? 'AZ_LATIN'),
      },
    });
    return works.map(withIncipit);
  }

  /** Poem of the day: the same for everyone until midnight in Baku */
  async poemOfTheDay() {
    const date = bakuDate();
    if (this.daily?.date === date) return this.daily.work;

    const count = await this.prisma.work.count({ where: READABLE_POEM });
    if (!count) throw new NotFoundException('No poems yet');
    const work = await this.prisma.work.findFirstOrThrow({
      where: READABLE_POEM,
      orderBy: { id: 'asc' },
      skip: hash(date) % count,
      select: {
        slug: true,
        titleAz: true,
        titleRu: true,
        titleEn: true,
        body: true,
        originalLang: true,
        form: true,
        year: true,
        author: { select: { slug: true, nameAz: true, nameRu: true, nameEn: true } },
        translations: {
          where: { language: 'AZ_LATIN', status: 'PUBLISHED' },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          take: 1,
          select: { body: true },
        },
      },
    });

    const { body, translations, ...rest } = work;
    const text = rest.originalLang === 'AZ_LATIN' ? body : translations[0]?.body ?? body;
    const daily = { ...rest, date, excerpt: excerpt(text) };
    this.daily = { date, work: daily };
    return daily;
  }

  /** Readable, unused slug from the title; titles in other scripts fall back to the author's slug */
  private async newSlug(titles: (string | null | undefined)[], authorId: string) {
    const author = await this.prisma.author.findUniqueOrThrow({
      where: { id: authorId },
      select: { slug: true },
    });
    const base = titles.map((t) => slugify(t ?? '')).find(Boolean) ?? `${author.slug}-eser`;
    return uniqueSlug(
      base,
      async (slug) =>
        (await this.prisma.work.count({
          where: { OR: [{ slug }, { previousSlugs: { has: slug } }] },
        })) > 0,
      author.slug,
    );
  }

  async create(dto: CreateWorkDto) {
    const slug = await this.newSlug([dto.titleAz, dto.titleRu, dto.titleEn], dto.authorId);
    const bodyHtml = renderMarkdown(dto.body);
    return this.prisma.work.create({
      data: { ...dto, slug, bodyHtml },
    });
  }

  async update(id: string, dto: Partial<CreateWorkDto>) {
    const data: Prisma.WorkUpdateInput = { ...dto };
    if (dto.body) {
      data.bodyHtml = renderMarkdown(dto.body);
    }
    return this.prisma.work.update({ where: { id }, data });
  }

  async reorder(id: string, order: number) {
    return this.prisma.work.update({
      where: { id },
      data: { order },
    });
  }

  async createFromPayload(payload: Record<string, unknown>, { publish = true } = {}) {
    const body = payload.body as string;
    const slug = await this.newSlug(
      [payload.titleAz as string, payload.titleRu as string, payload.titleEn as string],
      payload.authorId as string,
    );
    const bodyHtml = renderMarkdown(body);
    return this.prisma.work.create({
      data: {
        ...(payload as unknown as Prisma.WorkCreateInput),
        slug,
        bodyHtml,
        status: publish ? 'PUBLISHED' : 'DRAFT',
      },
    });
  }
}
