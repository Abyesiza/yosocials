import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Platform } from '../../../common/enums/platform.enum.js';
import { BlueskyCredentialsDto } from '../../integrations/providers/bluesky/bluesky-credentials.dto.js';
import { DiscordCredentialsDto } from '../../integrations/providers/discord/discord-credentials.dto.js';
import { MastodonCredentialsDto } from '../../integrations/providers/mastodon/mastodon-credentials.dto.js';
import { TelegramCredentialsDto } from '../../integrations/providers/telegram/telegram-credentials.dto.js';
import { AccountPersona } from '../enums/account-persona.enum.js';

export class ConnectAccountDto {
  @ApiProperty({ enum: Platform })
  @IsEnum(Platform)
  platform: Platform;

  /**
   * Shape depends on `platform`. Validated by that platform's provider, which
   * rejects unknown fields.
   */
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(BlueskyCredentialsDto) },
      { $ref: getSchemaPath(MastodonCredentialsDto) },
      { $ref: getSchemaPath(TelegramCredentialsDto) },
      { $ref: getSchemaPath(DiscordCredentialsDto) },
    ],
  })
  @IsObject()
  credentials: Record<string, unknown>;

  @ApiPropertyOptional({ enum: AccountPersona })
  @IsOptional()
  @IsEnum(AccountPersona)
  persona?: AccountPersona;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  voice?: string;
}

export const CREDENTIAL_DTOS = [
  BlueskyCredentialsDto,
  MastodonCredentialsDto,
  TelegramCredentialsDto,
  DiscordCredentialsDto,
];
