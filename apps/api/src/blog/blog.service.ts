import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { slugify } from '../common/utils/slug';
import { paginationArgs, paginatedResult } from '../common/utils/pagination';

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { page?: number; limit?: number }) {
    const { skip, take, page, limit } = paginationArgs(query);

    const where: Prisma.BlogPostWhereInput = { status: 'PUBLISHED' };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.blogPost.findMany({
        where,
        skip,
        take,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          titleAz: true,
          titleRu: true,
          excerpt: true,
          coverUrl: true,
          publishedAt: true,
          author: { select: { name: true, username: true } },
        },
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findBySlug(slug: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { slug, status: 'PUBLISHED' },
      include: {
        author: { select: { name: true, username: true, avatarUrl: true } },
      },
    });

    if (!post) throw new NotFoundException('Post not found');

    this.prisma.blogPost
      .update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    return post;
  }

  async create(dto: CreateBlogPostDto, authorId: string) {
    const slug = slugify(dto.titleAz);
    return this.prisma.blogPost.create({
      data: { ...dto, slug, authorId },
    });
  }

  async publish(id: string) {
    return this.prisma.blogPost.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }
}
