import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorType, Language, PublishStatus } from '@prisma/client';

export class CreateAuthorDto {
  @ApiProperty()
  @IsString()
  nameAz: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameRu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameFa?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  bornYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bornYearApprox?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  diedYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  diedYearApprox?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bornPlace?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diedPlace?: string;

  @ApiPropertyOptional({ enum: AuthorType })
  @IsOptional()
  @IsEnum(AuthorType)
  type?: AuthorType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({ enum: Language, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(Language, { each: true })
  writingLangs?: Language[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bioAz?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bioRu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bioEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  portraitUrl?: string;

  @ApiPropertyOptional({ enum: PublishStatus })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;
}
