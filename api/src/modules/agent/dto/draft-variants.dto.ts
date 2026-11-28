import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Platform } from '../../../common/enums/platform.enum.js';

export class DraftVariantsDto {
  @ApiProperty({ example: 'We just hit 10,000 users, thank the community' })
  @IsString({ message: 'Describe your idea in at least 3 characters' })
  @MinLength(3, { message: 'Describe your idea in at least 3 characters' })
  @MaxLength(4000, { message: 'Keep your idea to 4,000 characters or fewer' })
  idea: string;

  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray({ message: 'Choose at least one account' })
  @ArrayMinSize(1, { message: 'Choose at least one account' })
  @ArrayMaxSize(20, { message: 'Choose up to 20 accounts' })
  @IsUUID('all', { each: true })
  accountIds: string[];
}

export class DraftVariantDto {
  @ApiProperty() accountId: string;
  @ApiProperty({ enum: Platform }) platform: Platform;
  @ApiProperty() text: string;
  @ApiProperty({ description: 'False if the model ignored the length limit' })
  fits: boolean;
}

export class DraftVariantsResponseDto {
  @ApiProperty() model: string;
  @ApiProperty({ type: [DraftVariantDto] }) variants: DraftVariantDto[];
}
