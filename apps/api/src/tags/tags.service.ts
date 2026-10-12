import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/utils/slug';

/** A tag as readers see it: on a published work, and not removed by an editor */
const VISIBLE: Prisma.WorkTagWhereInput = { source: { not: 'REJECTED' }, work: { status: 'PUBLISHED' } };
const SOURCES = ['RULE', 'EDITOR', 'REJECTED'] as const;
const ASSIGNMENTS_PAGE = 50;

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  /** Every tag with its count of published works, in display order */
  async findAll() {
    const tags = await this.prisma.tag.findMany({
      orderBy: [{ kind: 'asc' }, { order: 'asc' }],
      select: {
        slug: true,
        kind: true,
        nameAz: true,
        nameRu: true,
        nameEn: true,
        _count: { select: { works: { where: VISIBLE } } },
      },
    });
    return tags.map(({ _count, ...tag }) => ({ ...tag, works: _count.works }));
  }

  /** One tag, plus the authors who have works under it (for author × tag filters) */
  async findBySlug(slug: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { slug },
      select: { id: true, slug: true, kind: true, nameAz: true, nameRu: true, nameEn: true },
    });
    if (!tag) throw new NotFoundException('Tag not found');

    const byAuthor = await this.prisma.work.groupBy({
      by: ['authorId'],
      where: { status: 'PUBLISHED', tags: { some: { tagId: tag.id, source: { not: 'REJECTED' } } } },
      _count: { _all: true },
    });
    const authors = await this.prisma.author.findMany({
      where: { id: { in: byAuthor.map((a) => a.authorId) } },
      select: { id: true, slug: true, nameAz: true, nameRu: true, nameEn: true },
    });
    const count = new Map(byAuthor.map((a) => [a.authorId, a._count._all]));

    const { id, ...rest } = tag;
    return {
      ...rest,
      works: byAuthor.reduce((sum, a) => sum + a._count._all, 0),
      authors: authors
        .map(({ id: authorId, ...a }) => ({ ...a, works: count.get(authorId) ?? 0 }))
        .sort((a, b) => b.works - a.works),
    };
  }

  /** Admin: every tag with its works counted by source, any status */
  async adminOverview() {
    const [tags, counts] = await Promise.all([
      this.prisma.tag.findMany({
        orderBy: [{ kind: 'asc' }, { order: 'asc' }],
        select: { id: true, slug: true, kind: true, nameAz: true, nameRu: true, nameEn: true },
      }),
      this.prisma.workTag.groupBy({ by: ['tagId', 'source'], _count: { _all: true } }),
    ]);
    return tags.map(({ id, ...tag }) => ({
      ...tag,
      counts: Object.fromEntries(
        SOURCES.map((source) => [
          source,
          counts.find((c) => c.tagId === id && c.source === source)?._count._all ?? 0,
        ]),
      ) as Record<(typeof SOURCES)[number], number>,
    }));
  }

  /** Admin: works carrying a tag, newest assignment first, optionally by source */
  async assignments(slug: string, query: { source?: string; page?: number; q?: string }) {
    const tag = await this.prisma.tag.findUnique({
      where: { slug },
      select: { id: true, slug: true, kind: true, nameAz: true, nameRu: true, nameEn: true },
    });
    if (!tag) throw new NotFoundException('Tag not found');

    const source = SOURCES.find((s) => s === query.source);
    const where: Prisma.WorkTagWhereInput = {
      tagId: tag.id,
      ...(source && { source }),
      ...(query.q && {
        work: { OR: [{ titleAz: { contains: query.q, mode: 'insensitive' } }, { slug: { contains: query.q } }] },
      }),
    };
    const page = Math.max(1, Number(query.page) || 1);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.workTag.findMany({
        where,
        orderBy: [{ work: { authorId: 'asc' } }, { work: { titleAz: 'asc' } }],
        skip: (page - 1) * ASSIGNMENTS_PAGE,
        take: ASSIGNMENTS_PAGE,
        select: {
          source: true,
          work: {
            select: {
              id: true,
              slug: true,
              titleAz: true,
              status: true,
              author: { select: { nameAz: true } },
            },
          },
        },
      }),
      this.prisma.workTag.count({ where }),
    ]);
    const { id, ...rest } = tag;
    return {
      tag: rest,
      data: rows,
      meta: { total, page, limit: ASSIGNMENTS_PAGE, totalPages: Math.ceil(total / ASSIGNMENTS_PAGE) },
    };
  }

  /**
   * Admin: works to put a tag on, found by title or author, each with its current state
   * for this tag (null when it has none). Titles match with or without Azerbaijani letters,
   * through the ASCII-folded slug.
   */
  async candidates(slug: string, query: { q?: string; author?: string; untagged?: boolean; page?: number }) {
    const tag = await this.prisma.tag.findUnique({ where: { slug }, select: { id: true } });
    if (!tag) throw new NotFoundException('Tag not found');

    const q = query.q?.trim();
    const folded = q ? slugify(q) : '';
    const where: Prisma.WorkWhereInput = {
      ...(query.author && { author: { slug: query.author } }),
      ...(q && {
        OR: [
          { titleAz: { contains: q, mode: 'insensitive' } },
          { titleRu: { contains: q, mode: 'insensitive' } },
          { titleEn: { contains: q, mode: 'insensitive' } },
          ...(folded ? [{ slug: { contains: folded } }] : []),
        ],
      }),
      // "Untagged" still lists works the tag was removed from, so they can be re-added
      ...(query.untagged && { tags: { none: { tagId: tag.id, source: { not: 'REJECTED' } } } }),
    };
    const page = Math.max(1, Number(query.page) || 1);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.work.findMany({
        where,
        orderBy: [{ authorId: 'asc' }, { collectionId: 'asc' }, { order: 'asc' }, { titleAz: 'asc' }],
        skip: (page - 1) * ASSIGNMENTS_PAGE,
        take: ASSIGNMENTS_PAGE,
        select: {
          id: true,
          slug: true,
          titleAz: true,
          status: true,
          form: true,
          year: true,
          author: { select: { nameAz: true } },
          tags: { where: { tagId: tag.id }, select: { source: true } },
        },
      }),
      this.prisma.work.count({ where }),
    ]);
    return {
      data: rows.map(({ tags, ...work }) => ({ work, source: tags[0]?.source ?? null })),
      meta: { total, page, limit: ASSIGNMENTS_PAGE, totalPages: Math.ceil(total / ASSIGNMENTS_PAGE) },
    };
  }

  /**
   * Admin: put a tag on many works or take it off. Adding marks it EDITOR; removing marks it
   * REJECTED, so the keyword rules won't bring it back. Returns how many works changed.
   */
  async bulkSet(slug: string, { add = [], remove = [] }: { add?: string[]; remove?: string[] }) {
    const tag = await this.prisma.tag.findUnique({ where: { slug }, select: { id: true } });
    if (!tag) throw new NotFoundException('Tag not found');
    const upsert = (workId: string, source: 'EDITOR' | 'REJECTED') =>
      this.prisma.workTag.upsert({
        where: { workId_tagId: { workId, tagId: tag.id } },
        create: { workId, tagId: tag.id, source },
        update: { source },
      });
    const removing = remove.filter((id) => !add.includes(id));
    const known = await this.prisma.work.count({ where: { id: { in: [...add, ...removing] } } });
    if (known !== new Set([...add, ...removing]).size) throw new NotFoundException('Unknown works in the request');
    await this.prisma.$transaction([...add.map((id) => upsert(id, 'EDITOR')), ...removing.map((id) => upsert(id, 'REJECTED'))]);
    return { added: add.length, removed: removing.length };
  }
}
