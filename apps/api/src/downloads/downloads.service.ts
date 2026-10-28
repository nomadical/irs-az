import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Language } from '@prisma/client';
import { isPublicDomain, type DownloadFormat } from '@irs-az/shared';
import { PrismaService } from '../prisma/prisma.service';
import { renderMarkdown } from '../common/utils/markdown';
import { buildEpub, buildText, type Book, type BookWork } from './book';

export interface DownloadFile {
  filename: string;
  contentType: string;
  body: Buffer;
}

const AUTHOR_FIELDS = { slug: true, nameAz: true, bornYear: true, diedYear: true, period: true, status: true } as const;
const WORK_FIELDS = {
  slug: true,
  titleAz: true,
  titleFa: true,
  originalLang: true,
  body: true,
  bodyHtml: true,
} as const;
const RTL: Language[] = ['FA', 'AR', 'AZ_ARABIC'];

type AuthorRow = { slug: string; nameAz: string; bornYear: number | null; diedYear: number | null; period: string | null; status: string };
type WorkRow = { slug: string; titleAz: string; titleFa: string | null; originalLang: Language; body: string; bodyHtml: string | null };

/** ASCII-only file name stem: slugs are already ASCII, this just guards the header */
function asciiStem(slug: string) {
  return slug.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'irs-az';
}

/**
 * Downloadable EPUB / TXT files. Only published content of public-domain authors (see
 * isPublicDomain in @irs-az/shared), and only the original text: translators' death years
 * are not recorded, so translations stay online-only.
 */
@Injectable()
export class DownloadsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private siteUrl() {
    const url = this.config.get<string>('SITE_URL') ?? this.config.get<string>('CORS_ORIGIN') ?? 'https://irs.az';
    return url.split(',')[0].replace(/\/+$/, '');
  }

  private assertPublicDomain(author: AuthorRow) {
    if (author.status !== 'PUBLISHED') throw new NotFoundException('Author not found');
    if (!isPublicDomain(author)) {
      throw new ForbiddenException('Downloads are offered only for public-domain authors (life + 70)');
    }
  }

  private lifespan(a: AuthorRow) {
    if (a.bornYear == null && a.diedYear == null) return a.period;
    return `${a.bornYear ?? '?'}–${a.diedYear ?? '?'}`;
  }

  private rightsNote(a: AuthorRow) {
    return a.diedYear != null
      ? `İctimai mülkiyyət (müəllifin vəfat ili: ${a.diedYear}). Public domain (author died ${a.diedYear}). Original text only.`
      : 'İctimai mülkiyyət. Public domain. Original text only.';
  }

  private bookWork(w: WorkRow): BookWork {
    return {
      slug: w.slug,
      title: RTL.includes(w.originalLang) && w.titleFa ? w.titleFa : w.titleAz,
      language: w.originalLang,
      html: w.bodyHtml ?? renderMarkdown(w.body),
    };
  }

  /** The most common original language, for the book's own language */
  private mainLanguage(works: WorkRow[], fallback: Language): Language {
    const counts = new Map<Language, number>();
    for (const w of works) counts.set(w.originalLang, (counts.get(w.originalLang) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
  }

  private render(book: Book, author: AuthorRow, stem: string, format: DownloadFormat): DownloadFile {
    const note = this.rightsNote(author);
    if (format === 'txt') {
      return { filename: `${stem}.txt`, contentType: 'text/plain; charset=utf-8', body: Buffer.from(buildText(book, note), 'utf8') };
    }
    return { filename: `${stem}.epub`, contentType: 'application/epub+zip', body: buildEpub(book, note) };
  }

  async work(slug: string, format: DownloadFormat): Promise<DownloadFile> {
    const work = await this.prisma.work.findUnique({
      where: { slug, status: 'PUBLISHED' },
      select: { ...WORK_FIELDS, author: { select: AUTHOR_FIELDS } },
    });
    if (!work) throw new NotFoundException('Work not found');
    this.assertPublicDomain(work.author);

    const item = this.bookWork(work);
    const book: Book = {
      key: `work:${work.slug}`,
      // The Azerbaijani title names the file in a reader's library; the chapter keeps the original
      title: work.titleAz,
      author: work.author.nameAz,
      lifespan: this.lifespan(work.author),
      language: work.originalLang,
      url: `${this.siteUrl()}/az/works/${work.slug}`,
      sections: [{ title: null, works: [item] }],
    };
    return this.render(book, work.author, asciiStem(work.slug), format);
  }

  async collection(slug: string, format: DownloadFormat): Promise<DownloadFile> {
    const collection = await this.prisma.collection.findUnique({
      where: { slug, status: 'PUBLISHED' },
      select: {
        slug: true,
        titleAz: true,
        originalLang: true,
        author: { select: AUTHOR_FIELDS },
        works: { where: { status: 'PUBLISHED' }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], select: WORK_FIELDS },
      },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    this.assertPublicDomain(collection.author);
    if (!collection.works.length) throw new NotFoundException('Collection has no published works');

    const book: Book = {
      key: `collection:${collection.slug}`,
      title: collection.titleAz,
      author: collection.author.nameAz,
      lifespan: this.lifespan(collection.author),
      language: this.mainLanguage(collection.works, collection.originalLang),
      url: `${this.siteUrl()}/az/collections/${collection.slug}`,
      sections: [{ title: null, works: collection.works.map((w) => this.bookWork(w)) }],
    };
    return this.render(book, collection.author, asciiStem(collection.slug), format);
  }

  /** Complete works: every published collection in order, then the uncollected works */
  async author(slug: string, format: DownloadFormat): Promise<DownloadFile> {
    const author = await this.prisma.author.findUnique({
      where: { slug, status: 'PUBLISHED' },
      select: {
        ...AUTHOR_FIELDS,
        collections: {
          where: { status: 'PUBLISHED' },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          select: {
            titleAz: true,
            works: { where: { status: 'PUBLISHED' }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], select: WORK_FIELDS },
          },
        },
        works: {
          where: { status: 'PUBLISHED', collectionId: null },
          orderBy: [{ year: 'asc' }, { createdAt: 'asc' }],
          select: WORK_FIELDS,
        },
      },
    });
    if (!author) throw new NotFoundException('Author not found');
    this.assertPublicDomain(author);

    const sections = author.collections
      .filter((c) => c.works.length)
      .map((c) => ({ title: c.titleAz, works: c.works.map((w) => this.bookWork(w)) }));
    if (author.works.length) {
      sections.push({ title: 'Sərbəst əsərlər', works: author.works.map((w) => this.bookWork(w)) });
    }
    if (!sections.length) throw new NotFoundException('Author has no published works');

    const allWorks = [...author.collections.flatMap((c) => c.works), ...author.works];
    const book: Book = {
      key: `author:${author.slug}`,
      title: `${author.nameAz}. Əsərləri`,
      author: author.nameAz,
      lifespan: this.lifespan(author),
      language: this.mainLanguage(allWorks, 'AZ_LATIN'),
      url: `${this.siteUrl()}/az/authors/${author.slug}`,
      sections,
    };
    return this.render(book, author, asciiStem(`${author.slug}-eserleri`), format);
  }
}
