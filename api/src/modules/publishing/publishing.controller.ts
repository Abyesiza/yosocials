import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublishOutcomeDto } from './dto/publish-result.dto.js';
import { PublishingService } from './publishing.service.js';

@ApiTags('posts')
@Controller('posts')
export class PublishingController {
  constructor(private readonly publishing: PublishingService) {}

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Publish a post's unpublished targets right now" })
  @ApiOkResponse({ type: [PublishOutcomeDto] })
  publishNow(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PublishOutcomeDto[]> {
    return this.publishing.publishNow(id);
  }
}
