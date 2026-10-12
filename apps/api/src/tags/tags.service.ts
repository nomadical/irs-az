import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PUBLISHED_WORK: Prisma.WorkTagWhereInput = { work: { status: 'PUBLISHED' } };

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
        _count: { select: { works: { where: PUBLISHED_WORK } } },
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
      where: { status: 'PUBLISHED', tags: { some: { tagId: tag.id } } },
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
}
