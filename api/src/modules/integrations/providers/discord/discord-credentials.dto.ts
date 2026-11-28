import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/**
 * Discord posts through a channel webhook: Server Settings → Integrations →
 * Webhooks → New Webhook → Copy Webhook URL. No bot or OAuth app needed.
 */
export class DiscordCredentialsDto {
  @ApiProperty({
    example: 'https://discord.com/api/webhooks/123456789012345678/abcDEF...',
  })
  @Matches(
    /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{17,20}\/[\w-]{20,}$/,
    {
      message:
        'Paste a Discord webhook URL, like https://discord.com/api/webhooks/…',
    },
  )
  webhookUrl: string;
}
