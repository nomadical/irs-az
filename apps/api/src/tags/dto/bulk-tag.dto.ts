import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

export class BulkTagDto {
  @ApiPropertyOptional({ description: 'Work ids to put the tag on (as an editor)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  add?: string[];

  @ApiPropertyOptional({ description: 'Work ids to take the tag off; the rules will not re-add it' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  remove?: string[];
}
