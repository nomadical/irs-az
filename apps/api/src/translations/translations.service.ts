import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { renderMarkdown } from '../common/utils/markdown';

@Injectable()
export class TranslationsService {
  constructor(private prisma: PrismaService) {}

  async findByWork(workId: string) {
    return this.prisma.translation.findMany({
      where: { workId, status: 'PUBLISHED' },
      orderBy: [{ isDefault: 'desc' }, { language: 'asc' }],
    });
  }

  async findByWorkAndLang(workId: string, language: string) {
    return this.prisma.translation.findFirst({
      where: { workId, language: language as any, status: 'PUBLISHED' },
    });
  }

  async create(dto: CreateTranslationDto) {
    const bodyHtml = renderMarkdown(dto.body);

    // If setting as default, unset other defaults for same work+language
    if (dto.isDefault) {
      await this.prisma.translation.updateMany({
        where: { workId: dto.workId, language: dto.language },
        data: { isDefault: false },
      });
    }

    return this.prisma.translation.create({
      data: { ...dto, bodyHtml },
    });
  }

  async update(id: string, dto: Partial<CreateTranslationDto>) {
    const data: Record<string, unknown> = { ...dto };
    if (dto.body) {
      data.bodyHtml = renderMarkdown(dto.body);
    }
    return this.prisma.translation.update({ where: { id }, data });
  }

  async setDefault(id: string) {
    const translation = await this.prisma.translation.findUniqueOrThrow({
      where: { id },
    });

    await this.prisma.translation.updateMany({
      where: { workId: translation.workId, language: translation.language },
      data: { isDefault: false },
    });

    return this.prisma.translation.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  async createFromPayload(
    payload: Record<string, unknown>,
    submissionId: string,
  ) {
    const body = payload.body as string;
    const bodyHtml = renderMarkdown(body);
    return this.prisma.translation.create({
      data: {
        ...(payload as any),
        bodyHtml,
        submissionId,
        status: 'DRAFT',
      },
    });
  }
}
