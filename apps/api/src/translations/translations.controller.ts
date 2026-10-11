import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { TranslationsService } from './translations.service';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Translations')
@Controller('translations')
export class TranslationsController {
  constructor(private translations: TranslationsService) {}

  @Public()
  @Get('work/:workId')
  findByWork(@Param('workId') workId: string) {
    return this.translations.findByWork(workId);
  }

  @Public()
  @Get('work/:workId/:lang')
  findByWorkAndLang(
    @Param('workId') workId: string,
    @Param('lang') lang: string,
  ) {
    return this.translations.findByWorkAndLang(workId, lang);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Post()
  create(@Body() dto: CreateTranslationDto) {
    return this.translations.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateTranslationDto>) {
    return this.translations.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Patch(':id/set-default')
  setDefault(@Param('id') id: string) {
    return this.translations.setDefault(id);
  }
}
