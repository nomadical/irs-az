import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBlogPostDto {
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
  titleEn?: string;

  @ApiProperty()
  @IsString()
  bodyAz: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyRu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relatedAuthorId?: string;
}
