import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Language, TranslationType, ScriptDirection } from '@prisma/client';

export class CreateTranslationDto {
  @ApiProperty()
  @IsString()
  workId: string;

  @ApiProperty({ enum: Language })
  @IsEnum(Language)
  language: Language;

  @ApiPropertyOptional({ enum: TranslationType })
  @IsOptional()
  @IsEnum(TranslationType)
  type?: TranslationType;

  @ApiPropertyOptional({ enum: ScriptDirection })
  @IsOptional()
  @IsEnum(ScriptDirection)
  scriptDirection?: ScriptDirection;

  @ApiProperty({ description: 'Body in Markdown' })
  @IsString()
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  translator?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  translatorNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
