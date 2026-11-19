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
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;
}

export class UpdateWorkspaceDto extends CreateWorkspaceDto {}

export class AddMemberDto {
  @ApiProperty({ example: 'teammate@example.com' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiProperty({ enum: WorkspaceRole, example: WorkspaceRole.Editor })
  @IsEnum(WorkspaceRole)
  role: WorkspaceRole;
}

export class UpdateMemberDto {
  @ApiProperty({ enum: WorkspaceRole })
  @IsEnum(WorkspaceRole)
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
