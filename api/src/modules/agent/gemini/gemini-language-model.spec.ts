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

const config = (env: Record<string, string | boolean | undefined>) =>
  ({ get: (k: string) => env[k] }) as unknown as ConfigService<
    EnvironmentVariables,
    true
  >;

const request = {
  system: 's',
  prompt: 'p',
  jsonSchema: { type: 'object' },
};

const model = (search = false) =>
  new GeminiLanguageModel(
    config({
      GEMINI_API_KEY: 'key',
      GEMINI_MODEL: 'primary',
      GEMINI_FALLBACK_MODELS: 'second, third',
      GEMINI_SEARCH_GROUNDING: search,
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

  describe('web search', () => {
    it('is off unless switched on and a key is set', () => {
      expect(model().canSearchWeb).toBe(false);
      expect(model(true).canSearchWeb).toBe(true);
      expect(
        new GeminiLanguageModel(
          config({ GEMINI_MODEL: 'm', GEMINI_SEARCH_GROUNDING: true }),
        ).canSearchWeb,
      ).toBe(false);
    });

    it('refuses to search when switched off', async () => {
      await expect(model().generateGrounded(request)).rejects.toThrow(
        /isn’t switched on/,
      );
      expect(generateContent).not.toHaveBeenCalled();
    });

    it('asks for Google Search with structured output and maps the grounding', async () => {
      generateContent.mockResolvedValueOnce({
        text: '{"ideas":[]}',
        candidates: [
          {
            groundingMetadata: {
              webSearchQueries: ['uganda trends this week'],
              searchEntryPoint: {
                renderedContent: '<style></style><div>chips</div>',
              },
              groundingChunks: [
                {
                  web: {
                    uri: 'https://vertexaisearch.example/1',
                    title: 'monitor.co.ug',
                  },
                },
                { web: { uri: 'https://vertexaisearch.example/2' } },
                { retrievedContext: { uri: 'ignored' } },
              ],
            },
          },
        ],
      });

      await expect(model(true).generateGrounded(request)).resolves.toEqual({
        data: { ideas: [] },
        grounding: {
          searchEntryPointHtml: '<style></style><div>chips</div>',
          sources: [
            { title: 'monitor.co.ug', uri: 'https://vertexaisearch.example/1' },
            {
              title: 'https://vertexaisearch.example/2',
              uri: 'https://vertexaisearch.example/2',
            },
          ],
          queries: ['uganda trends this week'],
        },
      });
      const { config: sent } = generateContent.mock.calls[0][0];
      expect(sent).toMatchObject({
        systemInstruction: 's',
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
        tools: [{ googleSearch: {} }],
      });
      expect(sent.abortSignal).toBeInstanceOf(AbortSignal);
    });

    it('returns null grounding when the model didn’t search', async () => {
      generateContent.mockResolvedValueOnce({
        text: '{}',
        candidates: [{ groundingMetadata: {} }],
      });
      await expect(model(true).generateGrounded(request)).resolves.toEqual({
        data: {},
        grounding: null,
      });
    });

    it('falls back between models like generateJson', async () => {
      generateContent
        .mockRejectedValueOnce(apiError(503))
        .mockResolvedValueOnce({ text: '{}' });
      await expect(model(true).generateGrounded(request)).resolves.toEqual({
        data: {},
        grounding: null,
      });
      expect(generateContent.mock.calls.map(([c]) => c.model)).toEqual([
        'primary',
        'second',
      ]);
    });
  });

  it('sends no tools for plain JSON requests', async () => {
    generateContent.mockResolvedValueOnce({ text: '{}' });
    await model(true).generateJson(request);
    expect(generateContent.mock.calls[0][0].config).not.toHaveProperty('tools');
  });
});
