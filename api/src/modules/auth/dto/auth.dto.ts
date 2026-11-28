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
  @IsEmail({}, { message: 'Enter an email address, like name@example.com' })
  @MaxLength(320, { message: 'Enter an email address, like name@example.com' })
  email: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @IsString({
    message: `Use at least ${PASSWORD_MIN} characters for your password`,
  })
  @MinLength(PASSWORD_MIN, {
    message: `Use at least ${PASSWORD_MIN} characters for your password`,
  })
  @MaxLength(PASSWORD_MAX, {
    message: `Use ${PASSWORD_MAX} characters or fewer for your password`,
  })
  password: string;

  @ApiProperty({ example: 'Joel', maxLength: 120 })
  @Transform(trim)
  @IsString({ message: 'Enter your name' })
  @MinLength(1, { message: 'Enter your name' })
  @MaxLength(120, { message: 'Use 120 characters or fewer for your name' })
  name: string;

  @ApiPropertyOptional({
    example: 'Acme Marketing',
    description:
      'Name of the first workspace. Defaults to "<name>\'s workspace".',
  })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Enter a workspace name' })
  @MinLength(1, { message: 'Enter a workspace name' })
  @MaxLength(120, {
    message: 'Use 120 characters or fewer for the workspace name',
  })
  workspaceName?: string;
}

export class SignInDto {
  @ApiProperty()
  @Transform(trim)
  @IsEmail({}, { message: 'Enter an email address, like name@example.com' })
  @MaxLength(320, { message: 'Enter an email address, like name@example.com' })
  email: string;

  @ApiProperty()
  @IsString({ message: 'Enter your password' })
  @MaxLength(PASSWORD_MAX, {
    message: `Use ${PASSWORD_MAX} characters or fewer for your password`,
  })
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
  @IsString({ message: 'Enter your password' })
  @MinLength(1, { message: 'Enter your password' })
  @MaxLength(PASSWORD_MAX, {
    message: `Use ${PASSWORD_MAX} characters or fewer for your password`,
  })
  password: string;
}
