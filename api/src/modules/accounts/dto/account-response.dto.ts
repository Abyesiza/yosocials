import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Platform } from '../../../common/enums/platform.enum.js';
import type { SocialAccount } from '../entities/social-account.entity.js';
import { AccountPersona } from '../enums/account-persona.enum.js';
import { AccountStatus } from '../enums/account-status.enum.js';

/** Public view of an account. Credentials are never part of a response. */
export class AccountResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: Platform }) platform: Platform;
  @ApiProperty() handle: string;
  @ApiProperty() displayName: string;
  @ApiPropertyOptional({ nullable: true }) profileUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) avatarUrl: string | null;
  @ApiProperty({ enum: AccountPersona }) persona: AccountPersona;
  @ApiPropertyOptional({ nullable: true }) voice: string | null;
  @ApiProperty({ enum: AccountStatus }) status: AccountStatus;
  @ApiPropertyOptional({ nullable: true }) lastError: string | null;
  @ApiProperty() createdAt: Date;

  static from(account: SocialAccount): AccountResponseDto {
    return {
      id: account.id,
      platform: account.platform,
      handle: account.handle,
      displayName: account.displayName,
      profileUrl: account.profileUrl,
      avatarUrl: account.avatarUrl,
      persona: account.persona,
      voice: account.voice,
      status: account.status,
      lastError: account.lastError,
      createdAt: account.createdAt,
    };
  }
}
