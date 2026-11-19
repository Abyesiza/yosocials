import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiParam } from '@nestjs/swagger';
import { WorkspaceRole } from '../enums/workspace-role.enum.js';
import { REQUIRED_ROLE } from '../workspace.constants.js';
import { WorkspaceAccessGuard } from '../guards/workspace-access.guard.js';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContext,
} from '../interfaces/workspace-context.interface.js';

/**
 * Marks a controller as scoped to `/workspaces/:workspaceId/...`: the caller
 * must be a member. Defaults to Viewer; tighten per route with RequireRole.
 */
export const WorkspaceScoped = () =>
  applyDecorators(
    UseGuards(WorkspaceAccessGuard),
    ApiBearerAuth(),
    ApiParam({ name: 'workspaceId', format: 'uuid' }),
    ApiForbiddenResponse({ description: 'Not a member, or role too low' }),
  );

/** Minimum role for a route (or every route of a controller). */
export const RequireRole = (role: WorkspaceRole) =>
  SetMetadata(REQUIRED_ROLE, role);

/** The resolved workspace membership for this request. */
export const CurrentWorkspace = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): WorkspaceContext => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ [WORKSPACE_CONTEXT]?: WorkspaceContext }>();
    const context = request[WORKSPACE_CONTEXT];
    if (!context) {
      throw new Error(
        'CurrentWorkspace used on a route without WorkspaceScoped',
      );
    }
    return context;
  },
);
