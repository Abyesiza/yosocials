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
    example: 'abysocials.bsky.social',
    description: 'Handle or DID',
  })
  @IsString({ message: 'Enter your Bluesky handle, like name.bsky.social' })
  @MinLength(3, { message: 'Enter your Bluesky handle, like name.bsky.social' })
  identifier: string;

  @ApiProperty({ example: 'abcd-efgh-ijkl-mnop' })
  @IsString({
    message:
      'Enter a Bluesky app password, like abcd-efgh-ijkl-mnop. Create one in Bluesky under Settings → Privacy and security → App passwords',
  })
  @Matches(/^[a-z0-9]{4}(-[a-z0-9]{4}){3}$/, {
    message:
      'Enter a Bluesky app password, like abcd-efgh-ijkl-mnop. Create one in Bluesky under Settings → Privacy and security → App passwords',
  })
  appPassword: string;

  @ApiPropertyOptional({
    example: 'https://bsky.social',
    description: 'PDS host. Only needed for self-hosted accounts.',
  })
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'Enter your Bluesky server address, starting with https://' },
  )
  service?: string;
}
