import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { PlatformApiError, requestJson } from '../http/http-client.js';
import { MEDIA_TYPES } from './media-types.js';

export interface UploadTicket {
  path: string;
  /** Signed Supabase URL the browser PUTs the file to; valid for 2 hours. */
  uploadUrl: string;
  publicUrl: string;
}

/**
 * Uploaded media in a public Supabase Storage bucket. Browsers upload
 * straight to signed URLs, so large videos never pass through the API.
 */
@Injectable()
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);
  private readonly url?: string;
  private readonly key?: string;
  private readonly bucket: string;
  private readonly publicBase: string;
  readonly maxBytes: number;
  private bucketReady?: Promise<void>;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.url = config.get('SUPABASE_URL', { infer: true })?.replace(/\/$/, '');
    this.key = config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true });
    this.bucket = config.get('MEDIA_BUCKET', { infer: true });
    this.publicBase = config
      .get('MEDIA_PUBLIC_BASE_URL', { infer: true })
      .replace(/\/$/, '');
    this.maxBytes = config.get('MEDIA_MAX_BYTES', { infer: true });
  }

  isConfigured(): boolean {
    return Boolean(this.url && this.key);
  }

  publicUrl(path: string): string {
    return `${this.publicBase}/${path}`;
  }

  async createUpload(
    workspaceId: string,
    contentType: string,
    size: number,
  ): Promise<UploadTicket> {
    const type = MEDIA_TYPES[contentType];
    if (!type) throw new BadRequestException(`${contentType} isn't supported`);
    if (size > this.maxBytes) {
      throw new BadRequestException(
        `Files can be up to ${Math.floor(this.maxBytes / 1024 / 1024)} MB`,
      );
    }
    await this.ensureBucket();
    const path = `${workspaceId}/${randomUUID()}.${type.ext}`;
    const signed = await this.call<{ url: string }>(
      `/object/upload/sign/${this.bucket}/${path}`,
      { json: {} },
    );
    return {
      path,
      uploadUrl: `${this.config().url}/storage/v1${signed.url}`,
      publicUrl: this.publicUrl(path),
    };
  }

  /** Best effort: a storage outage must not block deleting posts or workspaces. */
  async remove(paths: string[]): Promise<void> {
    if (!this.isConfigured() || paths.length === 0) return;
    try {
      await this.call(`/object/${this.bucket}`, {
        method: 'DELETE',
        json: { prefixes: paths },
      });
    } catch (error) {
      this.logger.warn(
        `Could not delete ${paths.length} media file(s): ${String(error)}`,
      );
    }
  }

  /** Deletes everything a workspace uploaded. */
  async removeWorkspace(workspaceId: string): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      for (;;) {
        const objects = await this.call<{ name: string }[]>(
          `/object/list/${this.bucket}`,
          { json: { prefix: `${workspaceId}/`, limit: 1000 } },
        );
        if (objects.length === 0) return;
        await this.remove(objects.map((o) => `${workspaceId}/${o.name}`));
        if (objects.length < 1000) return;
      }
    } catch (error) {
      this.logger.warn(
        `Could not clear media of a workspace: ${String(error)}`,
      );
    }
  }

  private ensureBucket(): Promise<void> {
    this.bucketReady ??= this.createBucketIfMissing().catch((error) => {
      this.bucketReady = undefined;
      throw error;
    });
    return this.bucketReady;
  }

  private async createBucketIfMissing(): Promise<void> {
    try {
      await this.call(`/bucket/${this.bucket}`);
    } catch (error) {
      if (
        !(error instanceof PlatformApiError) ||
        (error.status !== 400 && error.status !== 404)
      ) {
        throw error;
      }
      await this.call('/bucket', {
        json: {
          id: this.bucket,
          name: this.bucket,
          // Platforms like TikTok fetch media by URL, so objects are public.
          public: true,
          allowed_mime_types: Object.keys(MEDIA_TYPES),
        },
      });
      this.logger.log(`Created storage bucket "${this.bucket}"`);
    }
  }

  private config(): { url: string; key: string } {
    if (!this.url || !this.key) {
      throw new ServiceUnavailableException(
        'Media uploads are not set up yet (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)',
      );
    }
    return { url: this.url, key: this.key };
  }

  private call<T>(
    path: string,
    init: { method?: 'GET' | 'POST' | 'DELETE'; json?: unknown } = {},
  ): Promise<T> {
    const { url, key } = this.config();
    return requestJson<T>(`${url}/storage/v1${path}`, {
      ...init,
      headers: { authorization: `Bearer ${key}`, apikey: key },
    });
  }
}
