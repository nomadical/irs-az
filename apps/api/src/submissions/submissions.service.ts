import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
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

  async approve(id: string, reviewerId: string) {
    const sub = await this.prisma.submission.findUniqueOrThrow({ where: { id } });

    if (sub.status !== 'PENDING' && sub.status !== 'CHANGES_REQUESTED') {
      throw new BadRequestException('Submission is not reviewable');
    }

    const payload = sub.payload as Record<string, unknown>;

    switch (sub.type) {
      case 'AUTHOR': {
        const author = await this.authors.createFromPayload(payload);
        await this.prisma.submission.update({
          where: { id },
          data: {
            status: 'APPROVED',
            authorId: author.id,
            reviewedById: reviewerId,
            reviewedAt: new Date(),
          },
        });
        break;
      }
      case 'WORK': {
        const work = await this.works.createFromPayload(payload);
        await this.prisma.submission.update({
          where: { id },
          data: {
            status: 'APPROVED',
            workId: work.id,
            reviewedById: reviewerId,
            reviewedAt: new Date(),
          },
        });
        await this.search.indexWork(work.id);
        break;
      }
      case 'TRANSLATION': {
        await this.translations.createFromPayload(payload, id).catch((err) => {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new ConflictException('This work already has a translation in this language');
          }
          throw err;
        });
        await this.prisma.submission.update({
          where: { id },
          data: {
            status: 'APPROVED',
            reviewedById: reviewerId,
            reviewedAt: new Date(),
          },
        });
        break;
      }
    }
  }

  async reject(id: string, reviewerId: string, reviewNote: string) {
    return this.prisma.submission.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewNote,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });
  }

  async requestChanges(id: string, reviewerId: string, reviewNote: string) {
    return this.prisma.submission.update({
      where: { id },
      data: {
        status: 'CHANGES_REQUESTED',
        reviewNote,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });
  }
}
