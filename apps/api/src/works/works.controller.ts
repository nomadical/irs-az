import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { WorksService } from './works.service';
import { CreateWorkDto } from './dto/create-work.dto';
import { QueryWorksDto } from './dto/query-works.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Works')
@Controller('works')
export class WorksController {
  constructor(private works: WorksService) {}

  @Public()
  @Get()
  findAll(@Query() query: QueryWorksDto) {
    return this.works.findAll(query);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Get('by-id/:id')
  findById(@Param('id') id: string) {
    return this.works.findById(id);
  }

  @Public()
  @Get('random')
  random() {
    return this.works.random();
  }

  @Public()
  @Get('daily')
  poemOfTheDay() {
    return this.works.poemOfTheDay();
  }

  @Public()
  @Get('resolve/:slug')
  resolve(@Param('slug') slug: string) {
    return this.works.resolveSlug(slug);
  }

  @Public()
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.works.findBySlug(slug);
  }

  @Public()
  @Get(':slug/more')
  moreByAuthor(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.works.moreByAuthor(slug, locale);
  }

  @Public()
  @Get(':slug/nav')
  getNav(@Param('slug') slug: string) {
    return this.works.getNav(slug);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Post()
  create(@Body() dto: CreateWorkDto) {
    return this.works.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateWorkDto>) {
    return this.works.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Patch(':id/reorder')
  reorder(@Param('id') id: string, @Body('order') order: number) {
    return this.works.reorder(id, order);
  }
}
