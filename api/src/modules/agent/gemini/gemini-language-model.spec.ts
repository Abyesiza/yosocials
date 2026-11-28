import { ApiError } from '@google/genai';
import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../../config/env.validation.js';
import { GeminiLanguageModel } from './gemini-language-model.js';

const generateContent = vi.fn();

vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/genai')>();
  return {
    ...actual,
    GoogleGenAI: vi.fn(function () {
      return { models: { generateContent } };
    }),
  };
});

const config = (env: Record<string, string | undefined>) =>
  ({ get: (k: string) => env[k] }) as unknown as ConfigService<
    EnvironmentVariables,
    true
  >;

const request = {
  system: 's',
  prompt: 'p',
  jsonSchema: { type: 'object' },
};

const model = () =>
  new GeminiLanguageModel(
    config({
      GEMINI_API_KEY: 'key',
      GEMINI_MODEL: 'primary',
      GEMINI_FALLBACK_MODELS: 'second, third',
    }),
  );

const apiError = (status: number) =>
  new ApiError({ message: `HTTP ${status}`, status });

beforeEach(() => {
  generateContent.mockReset();
});

describe('GeminiLanguageModel', () => {
  it('falls back when a model is overloaded', async () => {
    generateContent
      .mockRejectedValueOnce(apiError(503))
      .mockRejectedValueOnce(apiError(429))
      .mockResolvedValueOnce({ text: '{"ok":true}' });

    await expect(model().generateJson(request)).resolves.toEqual({ ok: true });
    expect(generateContent.mock.calls.map(([c]) => c.model)).toEqual([
      'primary',
      'second',
      'third',
    ]);
  });

  it('stops at a non-transient error instead of trying other models', async () => {
    generateContent.mockRejectedValueOnce(apiError(400));
    await expect(model().generateJson(request)).rejects.toThrow(
      /couldn’t answer/,
    );
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('reports 503 when every model is overloaded', async () => {
    generateContent.mockImplementation(() => Promise.reject(apiError(503)));
    const error = await model()
      .generateJson(request)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it('caps each attempt with an abort signal', async () => {
    generateContent.mockResolvedValueOnce({ text: '{}' });
    await model().generateJson(request);
    expect(generateContent.mock.calls[0][0].config.abortSignal).toBeInstanceOf(
      AbortSignal,
    );
  });

  it('refuses to run without an API key', async () => {
    const noKey = new GeminiLanguageModel(config({ GEMINI_MODEL: 'm' }));
    await expect(noKey.generateJson(request)).rejects.toThrow(
      /aren’t available yet/,
    );
  });
});
