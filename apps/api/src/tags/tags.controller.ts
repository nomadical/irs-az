import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TagsService } from './tags.service';
import { BulkTagDto } from './dto/bulk-tag.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Tags')
@Controller('tags')
export class TagsController {
  constructor(private tags: TagsService) {}

  @Public()
  @Get()
  findAll() {
    return this.tags.findAll();
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Get('admin/overview')
  adminOverview() {
    return this.tags.adminOverview();
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Get(':slug/assignments')
  assignments(
    @Param('slug') slug: string,
    @Query('source') source?: string,
    @Query('page') page?: string,
    @Query('q') q?: string,
  ) {
    return this.tags.assignments(slug, { source, page: Number(page) || 1, q });
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Get(':slug/candidates')
  candidates(
    @Param('slug') slug: string,
    @Query('q') q?: string,
    @Query('author') author?: string,
    @Query('untagged') untagged?: string,
    @Query('page') page?: string,
  ) {
    return this.tags.candidates(slug, { q, author, untagged: untagged === 'true', page: Number(page) || 1 });
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Patch(':slug/works')
  bulkSet(@Param('slug') slug: string, @Body() dto: BulkTagDto) {
    return this.tags.bulkSet(slug, dto);
  }

  @Public()
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.tags.findBySlug(slug);
  }
}
