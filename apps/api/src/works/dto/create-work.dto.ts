import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Genre, Language, PoemForm, PublishStatus, ScriptDirection } from '@prisma/client';

export class CreateWorkDto {
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

  @ApiProperty({ description: 'Body in Markdown' })
  @IsString()
  body: string;

  @ApiProperty({ enum: Language })
  @IsEnum(Language)
  originalLang: Language;

  @ApiPropertyOptional({ enum: ScriptDirection })
  @IsOptional()
  @IsEnum(ScriptDirection)
  scriptDirection?: ScriptDirection;

  @ApiPropertyOptional({ enum: Genre })
  @IsOptional()
  @IsEnum(Genre)
  genre?: Genre;

  @ApiPropertyOptional({ enum: PoemForm })
  @IsOptional()
  @IsEnum(PoemForm)
  form?: PoemForm;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  yearApprox?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiProperty()
  @IsString()
  authorId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  collectionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceNote?: string;

  @ApiPropertyOptional({ enum: PublishStatus })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;
}
