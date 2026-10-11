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
import { BlogService } from './blog.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Blog')
@Controller('blog')
export class BlogController {
  constructor(private blog: BlogService) {}

  @Public()
  @Get()
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.blog.findAll({ page, limit });
  }

  @Public()
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.blog.findBySlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Post()
  create(
    @Body() dto: CreateBlogPostDto,
    @CurrentUser('id') authorId: string,
  ) {
    return this.blog.create(dto, authorId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Patch(':id/publish')
  publish(@Param('id') id: string) {
    return this.blog.publish(id);
  }
}
