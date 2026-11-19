import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, Public } from '@nestjs/authentication';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ChangePasswordDto,
  UpdateProfileDto,
} from '../users/dto/update-profile.dto.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import type { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { WorkspaceResponseDto } from '../workspaces/dto/workspace.dto.js';
import { WorkspaceRole } from '../workspaces/enums/workspace-role.enum.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { AccountDeletionService } from './account-deletion.service.js';
import { AuthService } from './auth.service.js';
import {
  AuthResponseDto,
  AuthTokensDto,
  DeleteAccountDto,
  MeResponseDto,
  RefreshTokenDto,
  SignInDto,
  SignUpDto,
  SignUpResponseDto,
} from './dto/auth.dto.js';

/** Sign-up, sign-in and token rotation. Rate limited per IP. */
@ApiTags('auth')
@Public()
@UseGuards(ThrottlerGuard)
@ApiTooManyRequestsResponse({ description: 'Too many attempts; wait a minute' })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  @ApiCreatedResponse({ type: SignUpResponseDto })
  async signUp(@Body() dto: SignUpDto): Promise<SignUpResponseDto> {
    const { user, workspace, tokens } = await this.auth.signUp(dto);
    return {
      user: UserResponseDto.from(user),
      workspace: WorkspaceResponseDto.from(workspace, WorkspaceRole.Owner),
      tokens,
    };
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Incorrect email or password' })
  async signIn(@Body() dto: SignInDto): Promise<AuthResponseDto> {
    const { user, tokens } = await this.auth.signIn(dto);
    return { user: UserResponseDto.from(user), tokens };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthTokensDto })
  @ApiUnauthorizedResponse({ description: 'Expired, revoked or reused token' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('signout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  signOut(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.auth.signOut(dto.refreshToken);
  }
}

/** The signed-in user's own profile. */
@ApiTags('auth')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly workspaces: WorkspacesService,
    private readonly deletion: AccountDeletionService,
  ) {}

  /** Deletes the account, its sessions, and workspaces where it is the only member. */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ThrottlerGuard)
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: User,
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    return this.deletion.deleteAccount(user.id, dto.password);
  }

  @Get()
  @ApiOkResponse({ type: MeResponseDto })
  async me(@CurrentUser() user: User): Promise<MeResponseDto> {
    const memberships = await this.workspaces.listForUser(user.id);
    return {
      user: UserResponseDto.from(user),
      workspaces: memberships.map((m) =>
        WorkspaceResponseDto.from(m.workspace, m.role),
      ),
    };
  }

  @Patch()
  @ApiOkResponse({ type: UserResponseDto })
  async update(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.users.updateProfile(user.id, dto));
  }

  /** Signs out every device and returns fresh tokens for this one. */
  @Post('password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @ApiOkResponse({ type: AuthTokensDto })
  changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ): Promise<AuthTokensDto> {
    return this.auth.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
