import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorType, Language } from '@prisma/client';

export class QueryAuthorsDto {
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

  @ApiPropertyOptional({ enum: AuthorType })
  @IsOptional()
  @IsEnum(AuthorType)
  type?: AuthorType;

  @ApiPropertyOptional()
  @IsOptional()
  period?: string;

  @ApiPropertyOptional({ enum: Language })
  @IsOptional()
  @IsEnum(Language)
  lang?: Language;

  @ApiPropertyOptional({ description: 'Century number, e.g. 12 for XII' })
  @IsOptional()
  @IsInt()
  century?: number;

  @ApiPropertyOptional({ description: 'First letter for alphabetical filter' })
  @IsOptional()
  letter?: string;

  @ApiPropertyOptional({ description: 'Part of a name, in any of the three languages' })
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ description: 'Sort order: name (default) or recent' })
  @IsOptional()
  sort?: 'name' | 'recent';

  @ApiPropertyOptional({ description: 'Include all statuses (for admin)' })
  @IsOptional()
  all?: string;
}
