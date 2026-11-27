import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/**
 * Telegram posts go through a bot (create one with @BotFather) that has been
 * added as an admin of the channel with "Post messages" permission.
 */
export class TelegramCredentialsDto {
  @ApiProperty({ example: '123456789:AAH...', description: 'From @BotFather' })
  @IsString()
  @Matches(/^\d+:[A-Za-z0-9_-]{30,}$/, {
    message: 'botToken must look like 123456789:ABC... (from @BotFather)',
  })
  botToken: string;

  @ApiProperty({
    example: '@abysocials',
    description: 'Public channel @username, or numeric id like -1001234567890',
  })
  @IsString()
  @Matches(/^(@[A-Za-z0-9_]{4,}|-?\d+)$/, {
    message: 'chatId must be a channel @username or a numeric chat id',
  })
  chatId: string;
}
