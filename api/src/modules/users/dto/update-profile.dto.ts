import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX, PASSWORD_MIN } from './password.constants.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Enter your name' })
  @MinLength(1, { message: 'Enter your name' })
  @MaxLength(120, { message: 'Use 120 characters or fewer for your name' })
  name?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString({ message: 'Enter your current password' })
  @MaxLength(PASSWORD_MAX, {
    message: `Use ${PASSWORD_MAX} characters or fewer for your password`,
  })
  currentPassword: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @IsString({
    message: `Use at least ${PASSWORD_MIN} characters for your new password`,
  })
  @MinLength(PASSWORD_MIN, {
    message: `Use at least ${PASSWORD_MIN} characters for your new password`,
  })
  @MaxLength(PASSWORD_MAX, {
    message: `Use ${PASSWORD_MAX} characters or fewer for your new password`,
  })
  newPassword: string;
}
