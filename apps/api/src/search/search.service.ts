import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch } from 'meilisearch';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { foldAz } from '../common/utils/slug';
import { highlight, matchStarts, opening, queryTerms, snippet } from './highlight';

const fold = (text: string | null | undefined) => (text ? foldAz(text) : text);

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
        // *Plain fields hold the same text without Azerbaijani letters (see foldAz), so
        // "qezel" finds "qəzəl". They are stripped from search responses.
        searchableAttributes: [
          'titleAz',
          'titleAzPlain',
          'titleRu',
          'titleFa',
          'authorNameAz',
          'authorNamePlain',
          'authorNameRu',
          'body',
          'bodyPlain',
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
          // For snippets and match positions (Meilisearch reports positions only for
          // returned attributes); stripped from search responses
          'body',
          'bodyRu',
          'titleAzPlain',
          'bodyPlain',
          'authorNamePlain',
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
        bodyPlain: fold(work.body.substring(0, 2000)),
        bodyRu: ruTranslation?.body?.substring(0, 2000),
        titleAzPlain: fold(work.titleAz),
        authorNameAz: work.author.nameAz,
        authorNamePlain: fold(work.author.nameAz),
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
      const result = await this.client.index('works').search(dto.q, {
        filter: filters.length ? filters : undefined,
        limit,
        offset,
        showMatchesPosition: true,
      });

      // Highlights are built here rather than by Meilisearch, so that matches in the hidden
      // *Plain fields and typo matches show up on the original text (see highlight.ts)
      const terms = queryTerms(dto.q ?? '');
      const hits = result.hits.map(
        // The *Plain fields and full bodies are only fetched to build highlights
        ({ body, bodyRu, titleAzPlain, bodyPlain, authorNamePlain, _matchesPosition: mp = {}, ...hit }) => {
          const title: string = hit.titleAz ?? '';
          const titleStarts = [...matchStarts(title, mp.titleAz), ...matchStarts(title, mp.titleAzPlain, true)];
          const bodyStarts = body ? [...matchStarts(body, mp.body), ...matchStarts(body, mp.bodyPlain, true)] : [];
          const author: string = hit.authorNameAz ?? '';
          const authorStarts = [
            ...matchStarts(author, mp.authorNameAz),
            ...matchStarts(author, mp.authorNamePlain, true),
          ];
          return {
            ...hit,
            _formatted: {
              titleAz: highlight(title, terms, titleStarts),
              authorNameAz: highlight(author, terms, authorStarts),
              body:
                (body && snippet(body, terms, bodyStarts)) ??
                (bodyRu && snippet(bodyRu, terms, matchStarts(bodyRu, mp.bodyRu))) ??
                (body ? opening(body) : null),
            },
          };
        },
      );
      return { ...result, hits };
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
