import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorsService } from '../authors/authors.service';
import { WorksService } from '../works/works.service';
import { TranslationsService } from '../translations/translations.service';
import { SearchService } from '../search/search.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { paginationArgs, paginatedResult } from '../common/utils/pagination';

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
        await this.translations.createFromPayload(payload, id);
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
