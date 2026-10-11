import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Genre, Language } from '@prisma/client';

export class SearchQueryDto {
  @ApiProperty()
  @IsString()
  q: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorSlug?: string;

  @ApiPropertyOptional({ enum: Genre })
  @IsOptional()
  @IsEnum(Genre)
  genre?: Genre;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  limit?: number;
}
