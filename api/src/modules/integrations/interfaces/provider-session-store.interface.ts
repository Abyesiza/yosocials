import type { Platform } from '../../../common/enums/platform.enum.js';

/** Where providers keep platform sessions so they survive restarts. */
export interface ProviderSessionStore {
  load<T>(key: string): Promise<T | null>;
  save(key: string, platform: Platform, data: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}
