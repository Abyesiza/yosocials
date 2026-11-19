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
import { AccountsService } from './accounts.service.js';
import { AccountResponseDto } from './dto/account-response.dto.js';
import {
  ConnectAccountDto,
  CREDENTIAL_DTOS,
} from './dto/connect-account.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

@ApiTags('accounts')
@ApiExtraModels(...CREDENTIAL_DTOS)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post()
  @ApiCreatedResponse({ type: AccountResponseDto })
  async connect(@Body() dto: ConnectAccountDto): Promise<AccountResponseDto> {
    return AccountResponseDto.from(await this.accounts.connect(dto));
  }

  @Get()
  @ApiOkResponse({ type: [AccountResponseDto] })
  async findAll(): Promise<AccountResponseDto[]> {
    return (await this.accounts.findAll()).map((a) =>
      AccountResponseDto.from(a),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: AccountResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccountResponseDto> {
    return AccountResponseDto.from(await this.accounts.findOne(id));
  }

  @Patch(':id')
  @ApiOkResponse({ type: AccountResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    return AccountResponseDto.from(await this.accounts.update(id, dto));
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AccountResponseDto })
  async reverify(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccountResponseDto> {
    return AccountResponseDto.from(await this.accounts.reverify(id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.accounts.remove(id);
  }
}
