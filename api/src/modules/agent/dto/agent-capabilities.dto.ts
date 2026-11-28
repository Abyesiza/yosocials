import { ApiProperty } from '@nestjs/swagger';

export class AgentCapabilitiesDto {
  @ApiProperty({ example: 'gemini-3.5-flash-lite' })
  model: string;

  @ApiProperty({
    description:
      'True when planning can search the web first (GEMINI_SEARCH_GROUNDING on, with a paid Gemini key)',
  })
  searchWeb: boolean;
}
