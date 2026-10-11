import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const select = { slug: true, updatedAt: true } as const;
const published = { status: 'PUBLISHED' } as const;

@Injectable()
export class SitemapService {
  constructor(private prisma: PrismaService) {}

  /** Slugs + last-modified dates of every published entity, for the web sitemap. */
  async entries() {
    const [authors, collections, works, blog] = await this.prisma.$transaction([
      this.prisma.author.findMany({ where: published, select }),
      this.prisma.collection.findMany({ where: published, select }),
      this.prisma.work.findMany({ where: published, select }),
      this.prisma.blogPost.findMany({ where: published, select }),
    ]);
    return { authors, collections, works, blog };
  }
}
