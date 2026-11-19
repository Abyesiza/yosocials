import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentWorkspace,
  RequireRole,
  WorkspaceScoped,
} from '../workspaces/decorators/workspace.decorators.js';
import { WorkspaceRole } from '../workspaces/enums/workspace-role.enum.js';
import type { WorkspaceContext } from '../workspaces/interfaces/workspace-context.interface.js';
import { AccountsService } from './accounts.service.js';
import { AccountResponseDto } from './dto/account-response.dto.js';
import {
  ConnectAccountDto,
  CREDENTIAL_DTOS,
} from './dto/connect-account.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

/** Viewers can see accounts; only admins connect, edit or remove them. */
@ApiTags('accounts')
@ApiExtraModels(...CREDENTIAL_DTOS)
@WorkspaceScoped()
@Controller('workspaces/:workspaceId/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post()
  @RequireRole(WorkspaceRole.Admin)
  @ApiCreatedResponse({ type: AccountResponseDto })
  async connect(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Body() dto: ConnectAccountDto,
  ): Promise<AccountResponseDto> {
    return AccountResponseDto.from(
      await this.accounts.connect(ws.workspaceId, dto),
    );
  }

  @Get()
  @ApiOkResponse({ type: [AccountResponseDto] })
  async findAll(
    @CurrentWorkspace() ws: WorkspaceContext,
  ): Promise<AccountResponseDto[]> {
    return (await this.accounts.findAll(ws.workspaceId)).map((a) =>
      AccountResponseDto.from(a),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: AccountResponseDto })
  async findOne(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccountResponseDto> {
    return AccountResponseDto.from(
      await this.accounts.findOne(ws.workspaceId, id),
    );
  }

  @Patch(':id')
  @RequireRole(WorkspaceRole.Admin)
  @ApiOkResponse({ type: AccountResponseDto })
  async update(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    return AccountResponseDto.from(
      await this.accounts.update(ws.workspaceId, id, dto),
    );
  }

  @Post(':id/verify')
  @RequireRole(WorkspaceRole.Admin)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AccountResponseDto })
  async reverify(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccountResponseDto> {
    return AccountResponseDto.from(
      await this.accounts.reverify(ws.workspaceId, id),
    );
  }

  @Delete(':id')
  @RequireRole(WorkspaceRole.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.accounts.remove(ws.workspaceId, id);
  }
}
