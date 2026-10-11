import { Injectable, BadRequestException } from '@nestjs/common';
import { Language, Prisma, SubmissionStatus, SubmissionType } from '@prisma/client';
import { ClassConstructor, instanceToPlain, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorsService } from '../authors/authors.service';
import { WorksService } from '../works/works.service';
import { TranslationsService } from '../translations/translations.service';
import { SearchService } from '../search/search.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import {
  AuthorPayload,
  PublicSubmissionDto,
  TranslationPayload,
  WorkPayload,
} from './dto/public-submission.dto';
import { paginationArgs, paginatedResult } from '../common/utils/pagination';

const payloadClasses: Record<SubmissionType, ClassConstructor<object>> = {
  WORK: WorkPayload,
  TRANSLATION: TranslationPayload,
  AUTHOR: AuthorPayload,
};

const RTL_LANGUAGES: Language[] = ['FA', 'AR', 'AZ_ARABIC'];

@Injectable()
export class SubmissionsService {
  constructor(
    private prisma: PrismaService,
    private authors: AuthorsService,
    private works: WorksService,
    private translations: TranslationsService,
    private search: SearchService,
  ) {}

  async create(dto: CreateSubmissionDto, userId: string) {
    return this.prisma.submission.create({
      data: {
        type: dto.type,
        payload: dto.payload as Prisma.InputJsonValue,
        sourceNote: dto.sourceNote,
        userId,
      },
    });
  }

  /**
   * Public submissions are untrusted: the payload is validated against a strict
   * per-type shape, since approval spreads it straight into a Prisma create.
   */
  async createPublic(dto: PublicSubmissionDto) {
    const instance = plainToInstance(payloadClasses[dto.type], dto.payload);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) {
      throw new BadRequestException(
        errors.flatMap((e) => Object.values(e.constraints ?? {}).map((m) => `payload.${m}`)),
      );
    }
    const payload: Record<string, unknown> = instanceToPlain(instance);

    if (dto.type === 'WORK') {
      await this.assertExists('author', payload.authorId as string);
      payload.scriptDirection = RTL_LANGUAGES.includes(payload.originalLang as Language) ? 'RTL' : 'LTR';
    }
    if (dto.type === 'TRANSLATION') {
      await this.assertExists('work', payload.workId as string);
      payload.scriptDirection = RTL_LANGUAGES.includes(payload.language as Language) ? 'RTL' : 'LTR';
    }
    if (dto.type !== 'AUTHOR' && dto.sourceNote) payload.sourceNote = dto.sourceNote;

    return this.prisma.submission.create({
      data: {
        type: dto.type,
        payload: payload as Prisma.InputJsonValue,
        sourceNote: dto.sourceNote,
        contactName: dto.contactName.trim(),
        contactEmail: dto.contactEmail.trim().toLowerCase(),
      },
      select: { id: true },
    });
  }

  private async assertExists(model: 'author' | 'work', id: string) {
    const where = { id, status: 'PUBLISHED' as const };
    const found =
      model === 'author'
        ? await this.prisma.author.findFirst({ where, select: { id: true } })
        : await this.prisma.work.findFirst({ where, select: { id: true } });
    if (!found) throw new BadRequestException(`Unknown ${model}`);
  }

  async findAll(query: { page?: number; limit?: number; status?: SubmissionStatus; type?: string }) {
    const { skip, take, page, limit } = paginationArgs(query);

    const where: Prisma.SubmissionWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.type && { type: query.type as any }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.submission.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, name: true } },
        },
      }),
      this.prisma.submission.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.submission.findUniqueOrThrow({
      where: { id },
      include: {
        user: { select: { id: true, username: true, name: true, email: true } },
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.submission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Approving publishes the new author, work or translation right away: the review is
   * the editorial check. Pass `publish: false` to create it as a draft instead.
   */
  async approve(id: string, reviewerId: string, { publish = true } = {}) {
    const sub = await this.assertReviewable(id);
    const payload = sub.payload as Record<string, unknown>;
    const reviewed = { status: 'APPROVED' as const, reviewedById: reviewerId, reviewedAt: new Date() };

    switch (sub.type) {
      case 'AUTHOR': {
        const author = await this.authors.createFromPayload(payload, { publish });
        await this.prisma.submission.update({ where: { id }, data: { ...reviewed, authorId: author.id } });
        return { type: sub.type, slug: author.slug, published: publish };
      }
      case 'WORK': {
        const work = await this.works.createFromPayload(payload, { publish });
        await this.prisma.submission.update({ where: { id }, data: { ...reviewed, workId: work.id } });
        if (publish) await this.reindex(work.id);
        return { type: sub.type, slug: work.slug, published: publish };
      }
      case 'TRANSLATION': {
        const translation = await this.translations.createFromPayload(payload, id, { publish });
        await this.prisma.submission.update({ where: { id }, data: reviewed });
        // The work's search entry includes its published translations
        if (publish) await this.reindex(translation.workId);
        const work = await this.prisma.work.findUniqueOrThrow({
          where: { id: translation.workId },
          select: { slug: true },
        });
        return { type: sub.type, slug: work.slug, translationId: translation.id, published: publish };
      }
    }
  }

  /** Search is secondary: an unreachable Meilisearch must not fail an approval that already saved. */
  private async reindex(workId: string) {
    await this.search.indexWork(workId).catch((err) => {
      console.warn(`Search reindex failed for work ${workId}: ${err.message}`);
    });
  }

  private async assertReviewable(id: string) {
    const sub = await this.prisma.submission.findUniqueOrThrow({ where: { id } });
    if (sub.status !== 'PENDING' && sub.status !== 'CHANGES_REQUESTED') {
      throw new BadRequestException('Submission is not reviewable');
    }
    return sub;
  }

  private cleanNote(reviewNote: unknown) {
    const note = typeof reviewNote === 'string' ? reviewNote.trim() : '';
    if (note.length > 2000) throw new BadRequestException('Review note is too long');
    return note || null;
  }

  async reject(id: string, reviewerId: string, reviewNote?: unknown) {
    await this.assertReviewable(id);
    const note = this.cleanNote(reviewNote);
    return this.prisma.submission.update({
      where: { id },
      data: {
        status: 'REJECTED',
        // Without a new note, keep the one from an earlier "request changes"
        ...(note && { reviewNote: note }),
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });
  }

  /** The note is what the contributor needs to fix, so it's required here. */
  async requestChanges(id: string, reviewerId: string, reviewNote?: unknown) {
    await this.assertReviewable(id);
    const note = this.cleanNote(reviewNote);
    if (!note) throw new BadRequestException('A review note is required when requesting changes');
    return this.prisma.submission.update({
      where: { id },
      data: {
        status: 'CHANGES_REQUESTED',
        reviewNote: note,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });
  }
}
