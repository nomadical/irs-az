import { BadRequestException, Controller, Get, Header, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { DOWNLOAD_FORMATS, type DownloadFormat } from '@irs-az/shared';
import { Public } from '../common/decorators/public.decorator';
import { ClientIpThrottlerGuard } from '../common/guards/client-ip-throttler.guard';
import { DownloadsService, type DownloadFile } from './downloads.service';

function parseFormat(format?: string): DownloadFormat {
  const value = (format ?? 'epub').toLowerCase();
  if (!(DOWNLOAD_FORMATS as string[]).includes(value)) {
    throw new BadRequestException(`format must be one of: ${DOWNLOAD_FORMATS.join(', ')}`);
  }
  return value as DownloadFormat;
}

function send(res: Response, file: DownloadFile) {
  res.set({
    'Content-Type': file.contentType,
    'Content-Disposition': `attachment; filename="${file.filename}"`,
    'Content-Length': String(file.body.length),
  });
  res.send(file.body);
}

/** EPUB / TXT downloads of public-domain works, collections and complete works */
@ApiTags('Downloads')
@Controller()
@UseGuards(ClientIpThrottlerGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class DownloadsController {
  constructor(private downloads: DownloadsService) {}

  @Public()
  @Get('works/:slug/download')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiQuery({ name: 'format', enum: DOWNLOAD_FORMATS, required: false })
  async work(@Param('slug') slug: string, @Query('format') format: string | undefined, @Res() res: Response) {
    send(res, await this.downloads.work(slug, parseFormat(format)));
  }

  @Public()
  @Get('collections/:slug/download')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiQuery({ name: 'format', enum: DOWNLOAD_FORMATS, required: false })
  async collection(@Param('slug') slug: string, @Query('format') format: string | undefined, @Res() res: Response) {
    send(res, await this.downloads.collection(slug, parseFormat(format)));
  }

  @Public()
  @Get('authors/:slug/download')
  @Header('Cache-Control', 'public, max-age=3600')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiQuery({ name: 'format', enum: DOWNLOAD_FORMATS, required: false })
  async author(@Param('slug') slug: string, @Query('format') format: string | undefined, @Res() res: Response) {
    send(res, await this.downloads.author(slug, parseFormat(format)));
  }
}
