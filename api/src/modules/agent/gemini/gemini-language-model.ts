import { GoogleGenAI } from '@google/genai';
import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../../config/env.validation.js';
import type {
  LanguageModel,
  StructuredGenerationRequest,
} from '../interfaces/language-model.interface.js';

@Injectable()
export class GeminiLanguageModel implements LanguageModel {
  readonly modelName: string;
  private readonly client: GoogleGenAI | null;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.modelName = config.get('GEMINI_MODEL', { infer: true });
    const apiKey = config.get('GEMINI_API_KEY', { infer: true });
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  async generateJson(request: StructuredGenerationRequest): Promise<unknown> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'The agent is not configured: set GEMINI_API_KEY',
      );
    }

    let text: string | undefined;
    try {
      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: request.prompt,
        config: {
          systemInstruction: request.system,
          responseMimeType: 'application/json',
          responseJsonSchema: request.jsonSchema,
          temperature: request.temperature ?? 0.7,
        },
      });
      text = response.text;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(`Gemini request failed: ${reason}`);
    }

    if (!text) {
      throw new BadGatewayException('Gemini returned an empty response');
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new BadGatewayException('Gemini returned invalid JSON');
    }
  }
}
