/**
 * The agent talks to models only through this interface, so Gemini can be
 * swapped (or mocked in tests) without touching the agent's logic.
 */
export interface StructuredGenerationRequest {
  system: string;
  prompt: string;
  /** JSON Schema the response must follow. */
  jsonSchema: Record<string, unknown>;
  temperature?: number;
}

export interface LanguageModel {
  /** Model id, for logs and responses. */
  readonly modelName: string;
  /** Returns the parsed JSON response. Callers must still validate it. */
  generateJson(request: StructuredGenerationRequest): Promise<unknown>;
}

export const LANGUAGE_MODEL = Symbol('LANGUAGE_MODEL');
