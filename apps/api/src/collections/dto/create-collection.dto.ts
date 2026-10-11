import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Genre, Language } from '@prisma/client';

export class CreateCollectionDto {
  @ApiProperty()
  @IsString()
  titleAz: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  titleRu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  titleFa?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  titleEn?: string;

  @ApiProperty()
  @IsString()
  authorId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  yearApprox?: boolean;

  @ApiPropertyOptional({ enum: Language })
  @IsOptional()
  @IsEnum(Language)
  originalLang?: Language;

  @ApiPropertyOptional({ enum: Genre })
  @IsOptional()
  @IsEnum(Genre)
  genre?: Genre;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionAz?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionRu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  order?: number;
}
