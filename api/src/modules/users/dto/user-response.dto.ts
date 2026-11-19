import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { User } from '../entities/user.entity.js';

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) lastSignInAt: Date | null;
  @ApiProperty() createdAt: Date;

  static from(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      lastSignInAt: user.lastSignInAt,
      createdAt: user.createdAt,
    };
  }
}
