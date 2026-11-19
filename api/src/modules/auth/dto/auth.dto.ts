import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserResponseDto } from '../../users/dto/user-response.dto.js';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
} from '../../users/dto/password.constants.js';
import { WorkspaceResponseDto } from '../../workspaces/dto/workspace.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class SignUpDto {
  @ApiProperty({ example: 'you@example.com' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  password: string;

  @ApiProperty({ example: 'Joel', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    example: 'Acme Marketing',
    description:
      'Name of the first workspace. Defaults to "<name>\'s workspace".',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  workspaceName?: string;
}

export class SignInDto {
  @ApiProperty()
  @Transform(trim)
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiProperty()
  @IsString()
  @MaxLength(PASSWORD_MAX)
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(512)
  refreshToken: string;
}

export class AuthTokensDto {
  @ApiProperty({ description: 'Send as `Authorization: Bearer <token>`' })
  accessToken: string;

  @ApiProperty({ description: 'Single use. Exchange at /auth/refresh.' })
  refreshToken: string;

  @ApiProperty({ description: 'Seconds until the access token expires' })
  expiresIn: number;

  @ApiProperty({ example: 'Bearer' })
  tokenType: 'Bearer';
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
  @ApiProperty({ type: AuthTokensDto }) tokens: AuthTokensDto;
}

export class SignUpResponseDto extends AuthResponseDto {
  @ApiProperty({ type: WorkspaceResponseDto }) workspace: WorkspaceResponseDto;
}

export class MeResponseDto {
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
  @ApiProperty({ type: [WorkspaceResponseDto] })
  workspaces: WorkspaceResponseDto[];
}

export class DeleteAccountDto {
  @ApiProperty({ description: 'Current password, to confirm' })
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX)
  password: string;
}
