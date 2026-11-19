import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccountPersona } from '../enums/account-persona.enum.js';

export class UpdateAccountDto {
  @ApiPropertyOptional({ enum: AccountPersona })
  @IsOptional()
  @IsEnum(AccountPersona)
  persona?: AccountPersona;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  voice?: string | null;
}
