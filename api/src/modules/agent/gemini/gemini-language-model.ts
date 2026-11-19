import { ApiError, GoogleGenAI } from '@google/genai';
import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../../config/env.validation.js';
import type {
  LanguageModel,
  StructuredGenerationRequest,
} from '../interfaces/language-model.interface.js';

/** Per model attempt. Planning a month of posts can take a while. */
const ATTEMPT_TIMEOUT_MS = 45_000;

/** Overloaded, rate limited or slow: worth trying the next model. */
const TRANSIENT_STATUSES = new Set([429, 500, 503, 504]);

class AttemptTimeout extends Error {}

/**
 * Gemini through @google/genai. Tries GEMINI_MODEL, then each of
 * GEMINI_FALLBACK_MODELS, moving on when a model is overloaded, rate limited
 * or too slow. The SDK's own retries are off: by default it retries 5 times
 * with up to a minute between tries, which can stall a request for minutes.
 */
@Injectable()
export class GeminiLanguageModel implements LanguageModel {
  private readonly logger = new Logger(GeminiLanguageModel.name);
  private readonly models: string[];
  private readonly client: GoogleGenAI | null;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const primary = config.get('GEMINI_MODEL', { infer: true });
    const fallbacks = (
      config.get('GEMINI_FALLBACK_MODELS', { infer: true }) ?? ''
    )
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    this.models = [...new Set([primary, ...fallbacks])];

    const apiKey = config.get('GEMINI_API_KEY', { infer: true });
    this.client = apiKey
      ? new GoogleGenAI({
          apiKey,
          httpOptions: { retryOptions: { attempts: 1 } },
        })
      : null;
  }

  /** The primary model; the one that answered may be a fallback. */
  get modelName(): string {
    return this.models[0];
  }

  async generateJson(request: StructuredGenerationRequest): Promise<unknown> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'The agent is not configured: set GEMINI_API_KEY',
      );
    }

    let lastError: unknown;
    for (const model of this.models) {
      try {
        return await this.attempt(this.client, model, request);
      } catch (error) {
        lastError = error;
        if (!this.isTransient(error)) break;
        this.logger.warn(
          `${model} unavailable (${this.describe(error)}), trying next model`,
        );
      }
    }

    if (lastError instanceof AttemptTimeout) {
      throw new GatewayTimeoutException(
        'The AI model is too slow to answer right now. Try again shortly.',
      );
    }
    if (this.isTransient(lastError)) {
      throw new ServiceUnavailableException(
        'The AI models are overloaded right now. Try again shortly.',
      );
    }
    throw new BadGatewayException(
      `Gemini request failed: ${this.describe(lastError)}`,
    );
  }

  private async attempt(
    client: GoogleGenAI,
    model: string,
    request: StructuredGenerationRequest,
  ): Promise<unknown> {
    let text: string | undefined;
    try {
      const response = await client.models.generateContent({
        model,
        contents: request.prompt,
        config: {
          systemInstruction: request.system,
          responseMimeType: 'application/json',
          responseJsonSchema: request.jsonSchema,
          temperature: request.temperature ?? 0.7,
          abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        },
      });
      text = response.text;
    } catch (error) {
      if (error instanceof Error && /abort|timeout/i.test(error.name)) {
        throw new AttemptTimeout(
          `no answer within ${ATTEMPT_TIMEOUT_MS / 1000}s`,
        );
      }
      throw error;
    }

    if (!text)
      throw new BadGatewayException('Gemini returned an empty response');
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new BadGatewayException('Gemini returned invalid JSON');
    }
  }

  private isTransient(error: unknown): boolean {
    return (
      error instanceof AttemptTimeout ||
      (error instanceof ApiError && TRANSIENT_STATUSES.has(error.status)) ||
      // Network failures surface as a plain TypeError("fetch failed").
      (error instanceof TypeError && /fetch failed/i.test(error.message))
    );
  }

  private describe(error: unknown): string {
    if (error instanceof ApiError) return `HTTP ${error.status}`;
    return error instanceof Error ? error.message.slice(0, 200) : String(error);
  }
}
