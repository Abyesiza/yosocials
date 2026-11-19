import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * Bluesky signs in with a handle plus an *app password* (Settings → Privacy
 * and security → App passwords), never the account's main password.
 */
export class BlueskyCredentialsDto {
  @ApiProperty({
    example: 'yosocials.bsky.social',
    description: 'Handle or DID',
  })
  @IsString()
  @MinLength(3)
  identifier: string;

  @ApiProperty({ example: 'abcd-efgh-ijkl-mnop' })
  @IsString()
  @Matches(/^[a-z0-9]{4}(-[a-z0-9]{4}){3}$/, {
    message: 'appPassword must be a Bluesky app password (xxxx-xxxx-xxxx-xxxx)',
  })
  appPassword: string;

  @ApiPropertyOptional({
    example: 'https://bsky.social',
    description: 'PDS host. Only needed for self-hosted accounts.',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  service?: string;
}
