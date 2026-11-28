import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UTApi } from 'uploadthing/server';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { MAX_BYTES, MAX_IMAGES, MEDIA_TYPES } from './media-types.js';

export interface UploadRequest {
  contentType: string;
  size: number;
}

/**
 * Uploaded media on UploadThing. The web app's upload route asks `reserve`
 * for each file's custom id, so files can only land in a workspace whose
 * editors asked for them; the API deletes them with the same ids.
 */
@Injectable()
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);
  private readonly utapi?: UTApi;
  private readonly publicBase: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const token = config.get('UPLOADTHING_TOKEN', { infer: true });
    // Late-bound so the global fetch in use at call time is the one used.
    this.utapi = token
      ? new UTApi({
          token,
          fetch: (input, init) => globalThis.fetch(input, init),
        })
      : undefined;
    this.publicBase = config
      .get('MEDIA_PUBLIC_BASE_URL', { infer: true })
      .replace(/\/$/, '');
  }

  isConfigured(): boolean {
    return Boolean(this.utapi);
  }

  publicUrl(path: string): string {
    return `${this.publicBase}/${path}`;
  }

  /** Validates an upload and returns one custom id per file, in order. */
  reserve(workspaceId: string, files: UploadRequest[]): string[] {
    if (!this.utapi) {
      throw new ServiceUnavailableException(
        'Media uploads aren’t available yet. Ask whoever runs Aby Socials to finish setting them up.',
      );
    }
    const kinds = files.map((f) => {
      const type = MEDIA_TYPES[f.contentType];
      if (!type)
        throw new BadRequestException(
          'Upload an MP4, MOV or WebM video, or a JPEG or WebP image.',
        );
      if (f.size > MAX_BYTES[type.kind]) {
        throw new BadRequestException(
          `${type.kind === 'video' ? 'Videos' : 'Photos'} can be up to ${MAX_BYTES[type.kind] / 1024 / 1024} MB. Use a smaller file.`,
        );
      }
      return type.kind;
    });
    if (kinds.includes('video') && kinds.length > 1) {
      throw new BadRequestException(
        'Upload one video, or photos only. Videos and photos can’t be mixed.',
      );
    }
    if (kinds.length > MAX_IMAGES) {
      throw new BadRequestException(`Upload up to ${MAX_IMAGES} photos.`);
    }
    return files.map(
      (f) => `${workspaceId}_${randomUUID()}.${MEDIA_TYPES[f.contentType].ext}`,
    );
  }

  /** Best effort: a storage outage must not block deleting posts or workspaces. */
  async remove(paths: string[]): Promise<void> {
    if (!this.utapi || paths.length === 0) return;
    try {
      await this.utapi.deleteFiles(paths, { keyType: 'customId' });
    } catch (error) {
      this.logger.warn(
        `Could not delete ${paths.length} media file(s): ${String(error)}`,
      );
    }
  }
}
