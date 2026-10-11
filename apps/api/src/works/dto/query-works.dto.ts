import { IsOptional, IsEnum, IsInt, IsString, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Genre, Language, PoemForm } from '@prisma/client';

export class QueryWorksDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorSlug?: string;

  @ApiPropertyOptional({ enum: Genre })
  @IsOptional()
  @IsEnum(Genre)
  genre?: Genre;

  @ApiPropertyOptional({ enum: PoemForm })
  @IsOptional()
  @IsEnum(PoemForm)
  form?: PoemForm;

  @ApiPropertyOptional({ enum: Language })
  @IsOptional()
  @IsEnum(Language)
  lang?: Language;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  yearFrom?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  yearTo?: number;

  @ApiPropertyOptional({ description: 'Sort order: year (default) or recent' })
  @IsOptional()
  sort?: 'year' | 'recent';

  @ApiPropertyOptional({ description: 'Include all statuses (for admin)' })
  @IsOptional()
  all?: string;
}
