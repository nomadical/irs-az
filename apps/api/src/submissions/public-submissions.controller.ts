import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SubmissionsService } from './submissions.service';
import { PublicSubmissionDto } from './dto/public-submission.dto';
import { Public } from '../common/decorators/public.decorator';
import { ClientIpThrottlerGuard } from '../common/guards/client-ip-throttler.guard';

/** Anonymous submissions from the public "Contribute" form. */
@ApiTags('Submissions')
@Controller('submissions/public')
@UseGuards(ClientIpThrottlerGuard)
export class PublicSubmissionsController {
  constructor(private submissions: SubmissionsService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 10 * 60_000 } })
  @Post()
  @HttpCode(201)
  async create(@Body() dto: PublicSubmissionDto) {
    // Pretend success to bots that filled the honeypot
    if (dto.website) return { ok: true };
    await this.submissions.createPublic(dto);
    return { ok: true };
  }
}
