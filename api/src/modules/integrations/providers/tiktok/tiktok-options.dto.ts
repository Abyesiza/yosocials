import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { TikTokPrivacyLevel } from './tiktok.types.js';

export const TIKTOK_PRIVACY_LEVELS: TikTokPrivacyLevel[] = [
  'PUBLIC_TO_EVERYONE',
  'MUTUAL_FOLLOW_FRIENDS',
  'FOLLOWER_OF_CREATOR',
  'SELF_ONLY',
];

/**
 * How a post goes out on TikTok. TikTok's content-sharing rules require the
 * creator to choose privacy and interactions themselves, so nothing here has
 * a default that turns something on.
 */
export class TikTokOptionsDto {
  @ApiProperty({
    enum: ['direct', 'inbox'],
    description:
      'direct: publish to the profile (video.publish). inbox: send as a draft the creator finishes in TikTok (video.upload).',
  })
  @IsIn(['direct', 'inbox'], {
    message: 'Choose whether to post directly or send to the TikTok inbox',
  })
  mode: 'direct' | 'inbox';

  @ApiPropertyOptional({
    enum: TIKTOK_PRIVACY_LEVELS,
    description: 'Required for direct posts',
  })
  @IsOptional()
  @IsIn(TIKTOK_PRIVACY_LEVELS, { message: 'Choose who can see this post' })
  privacyLevel?: TikTokPrivacyLevel;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowComment?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowDuet?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowStitch?: boolean;

  @ApiPropertyOptional({
    description: 'Promoting the creator’s own business (“Promotional content”)',
  })
  @IsOptional()
  @IsBoolean()
  brandOrganic?: boolean;

  @ApiPropertyOptional({
    description:
      'Paid partnership with a third-party brand (“Paid partnership”)',
  })
  @IsOptional()
  @IsBoolean()
  brandedContent?: boolean;

  @ApiPropertyOptional({ description: 'Label the video as AI-generated' })
  @IsOptional()
  @IsBoolean()
  isAigc?: boolean;

  @ApiPropertyOptional({
    maxLength: 90,
    description: 'Photo posts only; the post text becomes the description',
  })
  @IsOptional()
  @IsString({ message: 'Use 90 characters or fewer for the photo title' })
  @MaxLength(90, { message: 'Use 90 characters or fewer for the photo title' })
  photoTitle?: string;

  @ApiPropertyOptional({ description: 'Photo posts only' })
  @IsOptional()
  @IsBoolean()
  autoAddMusic?: boolean;
}
