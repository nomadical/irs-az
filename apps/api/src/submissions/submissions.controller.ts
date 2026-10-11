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
import { UserRole, SubmissionStatus } from '@prisma/client';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Submissions')
@Controller('submissions')
@UseGuards(AuthGuard('jwt'))
export class SubmissionsController {
  constructor(private submissions: SubmissionsService) {}

  @ApiBearerAuth()
  @Roles(UserRole.CONTRIBUTOR, UserRole.EDITOR, UserRole.SUPERADMIN)
  @UseGuards(RolesGuard)
  @Post()
  create(
    @Body() dto: CreateSubmissionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.submissions.create(dto, userId);
  }

  @ApiBearerAuth()
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @UseGuards(RolesGuard)
  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: SubmissionStatus,
    @Query('type') type?: string,
  ) {
    return this.submissions.findAll({ page, limit, status, type });
  }

  @ApiBearerAuth()
  @Get('mine')
  findMine(@CurrentUser('id') userId: string) {
    return this.submissions.findByUser(userId);
  }

  @ApiBearerAuth()
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @UseGuards(RolesGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.submissions.findById(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @UseGuards(RolesGuard)
  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser('id') reviewerId: string,
  ) {
    return this.submissions.approve(id, reviewerId);
  }

  @ApiBearerAuth()
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @UseGuards(RolesGuard)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser('id') reviewerId: string,
    @Body('reviewNote') reviewNote: string,
  ) {
    return this.submissions.reject(id, reviewerId, reviewNote);
  }

  @ApiBearerAuth()
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @UseGuards(RolesGuard)
  @Patch(':id/request-changes')
  requestChanges(
    @Param('id') id: string,
    @CurrentUser('id') reviewerId: string,
    @Body('reviewNote') reviewNote: string,
  ) {
    return this.submissions.requestChanges(id, reviewerId, reviewNote);
  }
}
