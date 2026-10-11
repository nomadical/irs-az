import { Injectable } from '@nestjs/common';
import { Language } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { renderMarkdown } from '../common/utils/markdown';

@Injectable()
export class TranslationsService {
  constructor(private prisma: PrismaService) {}

  async findByWork(workId: string) {
    return this.prisma.translation.findMany({
      where: { workId, status: 'PUBLISHED' },
      orderBy: [{ isDefault: 'desc' }, { language: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findByWorkAndLang(workId: string, language: string) {
    return this.prisma.translation.findFirst({
      where: { workId, language: language as any, status: 'PUBLISHED' },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /** A work's first translation into a language becomes its default for that language. */
  private async isFirstInLanguage(workId: string, language: Language) {
    const count = await this.prisma.translation.count({ where: { workId, language } });
    return count === 0;
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

    const isDefault = dto.isDefault ?? (await this.isFirstInLanguage(dto.workId, dto.language));
    return this.prisma.translation.create({
      data: { ...dto, isDefault, bodyHtml },
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
    { publish = true } = {},
  ) {
    const body = payload.body as string;
    const bodyHtml = renderMarkdown(body);
    const isDefault = await this.isFirstInLanguage(
      payload.workId as string,
      payload.language as Language,
    );
    return this.prisma.translation.create({
      data: {
        ...(payload as any),
        isDefault,
        bodyHtml,
        submissionId,
        status: publish ? 'PUBLISHED' : 'DRAFT',
      },
    });
  }
}
