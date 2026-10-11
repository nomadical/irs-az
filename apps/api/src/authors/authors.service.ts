import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuthorsDto } from './dto/query-authors.dto';
import { CreateAuthorDto } from './dto/create-author.dto';
import { slugify } from '../common/utils/slug';
import { renderMarkdown } from '../common/utils/markdown';
import {
  paginationArgs,
  paginatedResult,
} from '../common/utils/pagination';

@Injectable()
export class AuthorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryAuthorsDto) {
    const { skip, take, page, limit } = paginationArgs(query);

    const where: Prisma.AuthorWhereInput = {
      ...(query.all !== 'true' && { status: 'PUBLISHED' }),
      ...(query.type && { type: query.type }),
      ...(query.period && { period: query.period }),
      ...(query.lang && { writingLangs: { has: query.lang } }),
      ...(query.century && {
        bornYear: {
          gte: (query.century - 1) * 100 + 1,
          lte: query.century * 100,
        },
      }),
      ...(query.letter && {
        nameAz: { startsWith: query.letter, mode: 'insensitive' },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.author.findMany({
        where,
        skip,
        take,
        orderBy: query.sort === 'recent' ? { createdAt: 'desc' } : { nameAz: 'asc' },
        select: {
          id: true,
          slug: true,
          nameAz: true,
          nameRu: true,
          nameEn: true,
          bornYear: true,
          bornYearApprox: true,
          diedYear: true,
          diedYearApprox: true,
          type: true,
          period: true,
          portraitUrl: true,
          writingLangs: true,
          status: true,
          _count: { select: { works: true } },
        },
      }),
      this.prisma.author.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    const author = await this.prisma.author.findUnique({
      where: { id },
    });
    if (!author) throw new NotFoundException('Author not found');
    return author;
  }

  async findBySlug(slug: string) {
    const author = await this.prisma.author.findUnique({
      where: { slug, status: 'PUBLISHED' },
      include: {
        collections: {
          where: { status: 'PUBLISHED' },
          orderBy: { order: 'asc' },
          include: {
            works: {
              where: { status: 'PUBLISHED' },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                slug: true,
                titleAz: true,
                titleRu: true,
                genre: true,
                form: true,
                year: true,
                yearApprox: true,
                order: true,
              },
            },
          },
        },
        works: {
          where: { status: 'PUBLISHED', collectionId: null },
          orderBy: { year: 'asc' },
          select: {
            id: true,
            slug: true,
            titleAz: true,
            titleRu: true,
            genre: true,
            form: true,
            year: true,
            yearApprox: true,
          },
        },
        tags: { include: { tag: true } },
      },
    });

    if (!author) throw new NotFoundException('Author not found');

    return {
      ...author,
      bioAz: author.bioAz ? renderMarkdown(author.bioAz) : null,
      bioRu: author.bioRu ? renderMarkdown(author.bioRu) : null,
      bioEn: author.bioEn ? renderMarkdown(author.bioEn) : null,
    };
  }

  async findFeatured() {
    const select = {
      id: true,
      slug: true,
      nameAz: true,
      nameRu: true,
      nameEn: true,
      bornYear: true,
      diedYear: true,
      type: true,
      period: true,
      portraitUrl: true,
      bioAz: true,
      bioRu: true,
      bioEn: true,
      _count: { select: { works: true } },
    };

    // Try explicitly featured author first
    const featured = await this.prisma.author.findFirst({
      where: { featuredAt: { not: null }, status: 'PUBLISHED' },
      orderBy: { featuredAt: 'desc' },
      select,
    });

    if (featured) return featured;

    // Fallback: pick the author with the most works
    return this.prisma.author.findFirst({
      where: { status: 'PUBLISHED' },
      orderBy: { works: { _count: 'desc' } },
      select,
    });
  }

  async create(dto: CreateAuthorDto) {
    const slug = slugify(dto.nameAz);
    return this.prisma.author.create({
      data: { ...dto, slug },
    });
  }

  async update(id: string, dto: Partial<CreateAuthorDto>) {
    return this.prisma.author.update({
      where: { id },
      data: dto,
    });
  }

  async setFeatured(id: string) {
    return this.prisma.author.update({
      where: { id },
      data: { featuredAt: new Date() },
    });
  }

  async createFromPayload(payload: Record<string, unknown>) {
    const nameAz = payload.nameAz as string;
    const slug = slugify(nameAz);
    return this.prisma.author.create({
      data: { ...(payload as Prisma.AuthorCreateInput), slug, status: 'DRAFT' },
    });
  }
}
