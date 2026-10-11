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
import { AuthorsService } from './authors.service';
import { QueryAuthorsDto } from './dto/query-authors.dto';
import { CreateAuthorDto } from './dto/create-author.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Authors')
@Controller('authors')
export class AuthorsController {
  constructor(private authors: AuthorsService) {}

  @Public()
  @Get()
  findAll(@Query() query: QueryAuthorsDto) {
    return this.authors.findAll(query);
  }

  @Public()
  @Get('featured')
  findFeatured() {
    return this.authors.findFeatured();
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Get('by-id/:id')
  findById(@Param('id') id: string) {
    return this.authors.findById(id);
  }

  @Public()
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.authors.findBySlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Post()
  create(@Body() dto: CreateAuthorDto) {
    return this.authors.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateAuthorDto>) {
    return this.authors.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Patch(':id/feature')
  setFeatured(@Param('id') id: string) {
    return this.authors.setFeatured(id);
  }
}
