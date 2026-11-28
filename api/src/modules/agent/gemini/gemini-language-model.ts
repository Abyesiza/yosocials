import {
  ApiError,
  type GenerateContentResponse,
  GoogleGenAI,
  type GroundingMetadata,
  type Tool,
} from '@google/genai';
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
  GroundedGenerationResult,
  GroundingInfo,
  LanguageModel,
  StructuredGenerationRequest,
} from '../interfaces/language-model.interface.js';

/** Per model attempt. Planning a month of posts can take a while. */
const ATTEMPT_TIMEOUT_MS = 45_000;
/** Searching runs Google queries before the model starts answering. */
const GROUNDED_ATTEMPT_TIMEOUT_MS = 90_000;

/** Overloaded, rate limited or slow: worth trying the next model. */
const TRANSIENT_STATUSES = new Set([429, 500, 503, 504]);

class AttemptTimeout extends Error {}

interface AttemptOptions {
  timeoutMs: number;
  tools?: Tool[];
}

interface Answer {
  data: unknown;
  response: GenerateContentResponse;
}

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
  private readonly searchEnabled: boolean;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const primary = config.get('GEMINI_MODEL', { infer: true });
    const fallbacks = (
      config.get('GEMINI_FALLBACK_MODELS', { infer: true }) ?? ''
    )
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    this.models = [...new Set([primary, ...fallbacks])];

    this.searchEnabled =
      config.get('GEMINI_SEARCH_GROUNDING', { infer: true }) === true;
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

  /** Grounding with Google Search; needs a paid Gemini key, so it's off unless GEMINI_SEARCH_GROUNDING is on. */
  get canSearchWeb(): boolean {
    return this.searchEnabled && this.client !== null;
  }

  async generateJson(request: StructuredGenerationRequest): Promise<unknown> {
    return (await this.generate(request, { timeoutMs: ATTEMPT_TIMEOUT_MS }))
      .data;
  }

  async generateGrounded(
    request: StructuredGenerationRequest,
  ): Promise<GroundedGenerationResult> {
    if (!this.searchEnabled) {
      throw new ServiceUnavailableException(
        'Web search isn’t switched on for our AI. Ask whoever runs Aby Socials to turn it on.',
      );
    }
    const { data, response } = await this.generate(request, {
      timeoutMs: GROUNDED_ATTEMPT_TIMEOUT_MS,
      tools: [{ googleSearch: {} }],
    });
    return {
      data,
      grounding: toGrounding(response.candidates?.[0]?.groundingMetadata),
    };
  }

  private async generate(
    request: StructuredGenerationRequest,
    options: AttemptOptions,
  ): Promise<Answer> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'AI features aren’t available yet. Ask whoever runs Aby Socials to finish setting them up.',
      );
    }

    let lastError: unknown;
    for (const model of this.models) {
      try {
        return await this.attempt(this.client, model, request, options);
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
        'Our AI is taking too long to answer right now. Try again shortly.',
      );
    }
    if (this.isTransient(lastError)) {
      throw new ServiceUnavailableException(
        'Our AI is busy right now. Try again shortly.',
      );
    }
    this.logger.warn(`Gemini request failed: ${this.describe(lastError)}`);
    throw new BadGatewayException(
      'Our AI couldn’t answer that request. Try again in a moment.',
    );
  }

  private async attempt(
    client: GoogleGenAI,
    model: string,
    request: StructuredGenerationRequest,
    options: AttemptOptions,
  ): Promise<Answer> {
    let response: GenerateContentResponse;
    try {
      response = await client.models.generateContent({
        model,
        contents: request.prompt,
        config: {
          systemInstruction: request.system,
          responseMimeType: 'application/json',
          responseJsonSchema: request.jsonSchema,
          temperature: request.temperature ?? 0.7,
          ...(options.tools && { tools: options.tools }),
          abortSignal: AbortSignal.timeout(options.timeoutMs),
        },
      });
    } catch (error) {
      if (error instanceof Error && /abort|timeout/i.test(error.name)) {
        throw new AttemptTimeout(
          `no answer within ${options.timeoutMs / 1000}s`,
        );
      }
      throw error;
    }

    const text = response.text;
    if (!text)
      throw new BadGatewayException('Our AI didn’t send an answer. Try again.');
    try {
      return { data: JSON.parse(text) as unknown, response };
    } catch {
      throw new BadGatewayException(
        'Our AI gave an answer we couldn’t use. Try again.',
      );
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

/** Google's Search Suggestions and sources, kept as returned so they can be shown unmodified. */
function toGrounding(
  metadata: GroundingMetadata | undefined,
): GroundingInfo | null {
  if (!metadata) return null;
  const sources = (metadata.groundingChunks ?? []).flatMap((chunk) =>
    chunk.web?.uri
      ? [{ title: chunk.web.title ?? chunk.web.uri, uri: chunk.web.uri }]
      : [],
  );
  const searchEntryPointHtml =
    metadata.searchEntryPoint?.renderedContent ?? null;
  const queries = metadata.webSearchQueries ?? [];
  if (!searchEntryPointHtml && sources.length === 0 && queries.length === 0) {
    return null;
  }
  return { searchEntryPointHtml, sources, queries };
}
