import {
  IsEmail, IsEnum, IsInt, IsObject, IsOptional, IsString, Length, Max, MaxLength, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorType, Genre, Language, PoemForm, SubmissionType, TranslationType } from '@prisma/client';

const MAX_YEAR = new Date().getFullYear();
const MAX_BODY = 100_000;

export class PublicSubmissionDto {
  @ApiProperty({ enum: SubmissionType })
  @IsEnum(SubmissionType)
  type: SubmissionType;

  @ApiProperty({ description: 'WorkPayload, TranslationPayload or AuthorPayload, by type' })
  @IsObject()
  payload: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  @Length(2, 100)
  contactName: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(200)
  contactEmail: string;

  @ApiPropertyOptional({ description: 'Where the text comes from (book, edition, URL)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceNote?: string;

  /** Honeypot: hidden in the form, so only bots fill it. */
  @IsOptional()
  @IsString()
  website?: string;
}

// Payload shapes. Only these fields reach createFromPayload on approval.

export class WorkPayload {
  @IsString()
  authorId: string;

  @IsString()
  @Length(1, 200)
  titleAz: string;

  @IsOptional() @IsString() @MaxLength(200)
  titleRu?: string;

  @IsOptional() @IsString() @MaxLength(200)
  titleEn?: string;

  @IsEnum(Language)
  originalLang: Language;

  @IsEnum(Genre)
  genre: Genre;

  @IsOptional() @IsEnum(PoemForm)
  form?: PoemForm;

  @IsOptional() @IsInt() @Min(-3000) @Max(MAX_YEAR)
  year?: number;

  @IsString()
  @Length(1, MAX_BODY)
  body: string;
}

export class TranslationPayload {
  @IsString()
  workId: string;

  @IsEnum(Language)
  language: Language;

  @IsOptional() @IsEnum(TranslationType)
  type?: TranslationType;

  @IsString()
  @Length(1, MAX_BODY)
  body: string;

  @IsOptional() @IsString() @MaxLength(200)
  translator?: string;

  @IsOptional() @IsInt() @Min(-3000) @Max(MAX_YEAR)
  year?: number;

  @IsOptional() @IsString() @MaxLength(1000)
  translatorNote?: string;
}

export class AuthorPayload {
  @IsString()
  @Length(2, 200)
  nameAz: string;

  @IsOptional() @IsString() @MaxLength(200)
  nameRu?: string;

  @IsOptional() @IsString() @MaxLength(200)
  nameEn?: string;

  @IsEnum(AuthorType)
  type: AuthorType;

  @IsOptional() @IsInt() @Min(-3000) @Max(MAX_YEAR)
  bornYear?: number;

  @IsOptional() @IsInt() @Min(-3000) @Max(MAX_YEAR)
  diedYear?: number;

  @IsOptional() @IsString() @MaxLength(20_000)
  bioAz?: string;
}
