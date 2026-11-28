import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, MinLength } from 'class-validator';

/**
 * Mastodon is federated, so each account lives on an instance. The token is
 * created on that instance under Preferences → Development → New application,
 * with the scopes `read:accounts read:statuses write:statuses`.
 */
export class MastodonCredentialsDto {
  @ApiProperty({ example: 'https://mastodon.social' })
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    {
      message:
        'Enter your Mastodon server address, like https://mastodon.social',
    },
  )
  instanceUrl: string;

  @ApiProperty({ description: 'Access token from the instance' })
  @IsString({
    message:
      'Paste the access token from Preferences → Development on your Mastodon server',
  })
  @MinLength(20, {
    message:
      'Paste the access token from Preferences → Development on your Mastodon server',
  })
  accessToken: string;
}
