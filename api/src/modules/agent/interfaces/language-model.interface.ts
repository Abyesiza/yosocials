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

/**
 * Where a web-searched answer came from. Google's terms require showing
 * `searchEntryPointHtml` (Search Suggestions) unmodified, with the sources,
 * only to the person who asked, and never caching it for others.
 */
export interface GroundingInfo {
  /** Google's rendered Search Suggestions (HTML/CSS); show as is. */
  searchEntryPointHtml: string | null;
  sources: { title: string; uri: string }[];
  queries: string[];
}

export interface GroundedGenerationResult {
  data: unknown;
  /** Null when the model answered without searching. */
  grounding: GroundingInfo | null;
}

export interface LanguageModel {
  /** Model id, for logs and responses. */
  readonly modelName: string;
  /** True when searching the web is switched on (GEMINI_SEARCH_GROUNDING) and possible. */
  readonly canSearchWeb: boolean;
  /** Returns the parsed JSON response. Callers must still validate it. */
  generateJson(request: StructuredGenerationRequest): Promise<unknown>;
  /** Like `generateJson`, letting the model search the web first. Only call when `canSearchWeb`. */
  generateGrounded(
    request: StructuredGenerationRequest,
  ): Promise<GroundedGenerationResult>;
}

export const LANGUAGE_MODEL = Symbol('LANGUAGE_MODEL');
