import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Upload')
@Controller('upload')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UploadController {
  // R2 upload integration — to be implemented with @aws-sdk/client-s3
  @Roles(UserRole.EDITOR, UserRole.SUPERADMIN)
  @Post()
  async upload() {
    // TODO: implement presigned URL generation for Cloudflare R2
    return { message: 'Upload endpoint — not yet implemented' };
  }
}
