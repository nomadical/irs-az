import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkDto } from './dto/create-work.dto';
import { QueryWorksDto } from './dto/query-works.dto';
import { slugify, uniqueSlug } from '../common/utils/slug';
import { renderMarkdown } from '../common/utils/markdown';
import { paginationArgs, paginatedResult } from '../common/utils/pagination';

@Injectable()
export class WorksService {
  constructor(private prisma: PrismaService) {}

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
      ...(query.q && {
        OR: (['titleAz', 'titleRu', 'titleEn'] as const).map((field) => ({
          [field]: { contains: query.q, mode: 'insensitive' as const },
        })),
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.work.findMany({
        where,
        skip,
        take,
        orderBy: query.sort === 'recent' ? { createdAt: 'desc' } : { year: 'asc' },
        select: {
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

    return paginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    const work = await this.prisma.work.findUnique({
      where: { id },
      include: {
        author: { select: { slug: true, nameAz: true } },
        collection: { select: { slug: true, titleAz: true } },
      },
    });
    if (!work) throw new NotFoundException('Work not found');
    return work;
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
            isDefault: true,
            scriptDirection: true,
          },
        },
        tags: { include: { tag: true } },
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
