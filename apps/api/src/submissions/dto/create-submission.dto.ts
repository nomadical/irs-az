import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubmissionType } from '@prisma/client';

export class CreateSubmissionDto {
  @ApiProperty({ enum: SubmissionType })
  @IsEnum(SubmissionType)
  type: SubmissionType;

  @ApiProperty({ description: 'Content payload — shape varies by type' })
  @IsObject()
  payload: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceNote?: string;
}
