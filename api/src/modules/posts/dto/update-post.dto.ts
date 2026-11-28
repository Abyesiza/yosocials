import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MediaItemDto } from './media-item.dto.js';

export class UpdatePostDto {
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @IsString({ message: 'Use 200 characters or fewer for the title' })
  @MaxLength(200, { message: 'Use 200 characters or fewer for the title' })
  title?: string | null;

  @ApiPropertyOptional({ maxLength: 10_000 })
  @IsOptional()
  @IsString({ message: 'Write something for the post' })
  @MinLength(1, { message: 'Write something for the post' })
  @MaxLength(10_000, { message: 'Posts can be up to 10,000 characters' })
  body?: string;

  @ApiPropertyOptional({ type: [MediaItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(35, { message: 'Attach up to 35 photos' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  media?: MediaItemDto[];
}

export class UpdatePostTargetDto {
  @ApiPropertyOptional({
    nullable: true,
    description: "null resets to the post's body",
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString({ message: 'Write something for this account’s version' })
  @MinLength(1, { message: 'Write something for this account’s version' })
  @MaxLength(10_000, { message: 'Posts can be up to 10,000 characters' })
  text?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Date)
  @IsDate({ message: 'Choose a date and time' })
  scheduledAt?: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'null clears the settings',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  options?: Record<string, unknown> | null;
}
