import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SitemapService } from './sitemap.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Sitemap')
@Controller('sitemap')
export class SitemapController {
  constructor(private sitemap: SitemapService) {}

  @Public()
  @Get()
  entries() {
    return this.sitemap.entries();
  }
}
