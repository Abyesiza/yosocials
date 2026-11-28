import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  IsTimeZone,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { WorkspaceMember } from '../entities/workspace-member.entity.js';
import type { Workspace } from '../entities/workspace.entity.js';
import { WorkspaceRole } from '../enums/workspace-role.enum.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Acme Marketing', maxLength: 120 })
  @Transform(trim)
  @IsString({ message: 'Enter a workspace name' })
  @MinLength(1, { message: 'Enter a workspace name' })
  @MaxLength(120, {
    message: 'Use 120 characters or fewer for the workspace name',
  })
  name: string;
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: 'Acme Marketing', maxLength: 120 })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Enter a workspace name' })
  @MinLength(1, { message: 'Enter a workspace name' })
  @MaxLength(120, {
    message: 'Use 120 characters or fewer for the workspace name',
  })
  name?: string;

  @ApiPropertyOptional({
    example: 'UG',
    nullable: true,
    description:
      'Where most of the audience lives (ISO 3166-1 alpha-2); null clears it',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsISO31661Alpha2({ message: 'Choose your audience’s country from the list' })
  audienceCountry?: string | null;

  @ApiPropertyOptional({
    example: 'Africa/Kampala',
    description: 'Your audience’s time zone; suggested posting times use it',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsTimeZone({ message: 'Choose your audience’s time zone from the list' })
  audienceTimeZone?: string | null;
}

export class AddMemberDto {
  @ApiProperty({ example: 'teammate@example.com' })
  @Transform(trim)
  @IsEmail({}, { message: 'Enter their email address, like name@example.com' })
  @MaxLength(320, {
    message: 'Enter their email address, like name@example.com',
  })
  email: string;

  @ApiProperty({ enum: WorkspaceRole, example: WorkspaceRole.Editor })
  @IsEnum(WorkspaceRole, {
    message: 'Choose a role: owner, admin, editor or viewer',
  })
  role: WorkspaceRole;
}

export class UpdateMemberDto {
  @ApiProperty({ enum: WorkspaceRole })
  @IsEnum(WorkspaceRole, {
    message: 'Choose a role: owner, admin, editor or viewer',
  })
  role: WorkspaceRole;
}

export class WorkspaceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: WorkspaceRole, description: "The caller's role" })
  role: WorkspaceRole;
  @ApiPropertyOptional({
    example: 'UG',
    nullable: true,
    description: 'ISO 3166-1 alpha-2',
  })
  audienceCountry: string | null;
  @ApiPropertyOptional({
    example: 'Africa/Kampala',
    nullable: true,
    description: 'IANA time zone; null until set (times then use UTC)',
  })
  audienceTimeZone: string | null;
  @ApiProperty() createdAt: Date;

  static from(workspace: Workspace, role: WorkspaceRole): WorkspaceResponseDto {
    return {
      id: workspace.id,
      name: workspace.name,
      role,
      audienceCountry: workspace.audienceCountry,
      audienceTimeZone: workspace.audienceTimeZone,
      createdAt: workspace.createdAt,
    };
  }
}

export class MemberResponseDto {
  @ApiProperty() userId: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: WorkspaceRole }) role: WorkspaceRole;
  @ApiProperty() joinedAt: Date;

  static from(member: WorkspaceMember): MemberResponseDto {
    return {
      userId: member.userId,
      email: member.user.email,
      name: member.user.name,
      role: member.role,
      joinedAt: member.createdAt,
    };
  }
}
