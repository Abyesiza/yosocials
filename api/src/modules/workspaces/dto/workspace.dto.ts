import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
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

export class UpdateWorkspaceDto extends CreateWorkspaceDto {}

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
  @ApiProperty() createdAt: Date;

  static from(workspace: Workspace, role: WorkspaceRole): WorkspaceResponseDto {
    return {
      id: workspace.id,
      name: workspace.name,
      role,
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
