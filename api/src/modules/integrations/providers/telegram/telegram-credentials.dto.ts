import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/**
 * Telegram posts go through a bot (create one with @BotFather) that has been
 * added as an admin of the channel with "Post messages" permission.
 */
export class TelegramCredentialsDto {
  @ApiProperty({ example: '123456789:AAH...', description: 'From @BotFather' })
  @IsString({
    message: 'Paste the bot token from @BotFather, like 123456789:ABC…',
  })
  @Matches(/^\d+:[A-Za-z0-9_-]{30,}$/, {
    message: 'Paste the bot token from @BotFather, like 123456789:ABC…',
  })
  botToken: string;

  @ApiProperty({
    example: '@abysocials',
    description: 'Public channel @username, or numeric id like -1001234567890',
  })
  @IsString({
    message:
      'Enter the channel’s @username, or its numeric ID like -1001234567890',
  })
  @Matches(/^(@[A-Za-z0-9_]{4,}|-?\d+)$/, {
    message:
      'Enter the channel’s @username, or its numeric ID like -1001234567890',
  })
  chatId: string;
}
