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
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  idea: string;

  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
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
