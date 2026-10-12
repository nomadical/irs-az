import { IsArray, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SetWorkTagsDto {
  @ApiPropertyOptional({ description: 'Tag slugs to put on the work (as an editor)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  add?: string[];

  @ApiPropertyOptional({ description: 'Tag slugs to take off the work; the rules will not re-add them' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  remove?: string[];
}
