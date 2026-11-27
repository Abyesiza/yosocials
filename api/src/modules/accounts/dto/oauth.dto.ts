import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class OAuthStartResponseDto {
  @ApiProperty({ description: 'Send the user here to approve access' })
  url: string;

  @ApiProperty({
    description: 'Also kept by the web app, to check the callback against',
  })
  state: string;
}

export class OAuthCallbackDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  code: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  state: string;
}
