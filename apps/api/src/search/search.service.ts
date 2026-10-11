import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch } from 'meilisearch';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService implements OnModuleInit {
  private client: MeiliSearch;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.client = new MeiliSearch({
      host: this.config.get('MEILISEARCH_HOST', 'http://localhost:7700'),
      apiKey: this.config.get('MEILISEARCH_KEY', ''),
    });
  }

  async onModuleInit() {
    try {
      const index = this.client.index('works');
      await index.updateSettings({
        searchableAttributes: [
          'titleAz',
          'titleRu',
          'titleFa',
          'authorNameAz',
          'authorNameRu',
          'body',
          'bodyRu',
        ],
        filterableAttributes: [
          'authorSlug',
          'genre',
          'form',
          'lang',
          'year',
        ],
        sortableAttributes: ['year', 'titleAz'],
        displayedAttributes: [
          'id',
          'slug',
          'titleAz',
          'titleRu',
          'authorNameAz',
          'authorNameRu',
          'authorSlug',
          'genre',
          'form',
          'year',
          'lang',
        ],
      });
    } catch {
      console.warn('Meilisearch not available — search will be unavailable');
    }
  }

  async indexWork(workId: string) {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      include: {
        author: { select: { nameAz: true, nameRu: true, slug: true } },
        translations: {
          where: { status: 'PUBLISHED' },
          select: { language: true, body: true, isDefault: true },
        },
      },
    });

    if (!work) return;

    const ruTranslation = work.translations.find(
      (t) => t.language === 'RU' && t.isDefault,
    );

    await this.client.index('works').addDocuments([
      {
        id: work.id,
        slug: work.slug,
        titleAz: work.titleAz,
        titleRu: work.titleRu,
        titleFa: work.titleFa,
        body: work.body.substring(0, 2000),
        bodyRu: ruTranslation?.body?.substring(0, 2000),
        authorNameAz: work.author.nameAz,
        authorNameRu: work.author.nameRu,
        authorSlug: work.author.slug,
        genre: work.genre,
        form: work.form,
        year: work.year,
        lang: work.originalLang,
      },
    ]);
  }

  async search(dto: SearchQueryDto) {
    const filters: string[] = [];
    if (dto.authorSlug) filters.push(`authorSlug = "${dto.authorSlug}"`);
    if (dto.genre) filters.push(`genre = "${dto.genre}"`);
    if (dto.lang) filters.push(`lang = "${dto.lang}"`);
    if (dto.yearFrom) filters.push(`year >= ${dto.yearFrom}`);
    if (dto.yearTo) filters.push(`year <= ${dto.yearTo}`);

    const limit = Math.min(dto.limit ?? 20, 100);
    const offset = ((dto.page ?? 1) - 1) * limit;

    try {
      return await this.client.index('works').search(dto.q, {
        filter: filters.length ? filters : undefined,
        limit,
        offset,
        attributesToHighlight: ['titleAz', 'titleRu', 'body', 'bodyRu'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>',
        attributesToCrop: ['body', 'bodyRu'],
        cropLength: 80,
      });
    } catch {
      return { hits: [], query: dto.q, estimatedTotalHits: 0 };
    }
  }

  async reindexAll() {
    const works = await this.prisma.work.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true },
    });

    for (const work of works) {
      await this.indexWork(work.id);
    }
  }
}
