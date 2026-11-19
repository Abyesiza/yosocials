import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Platform } from '../../../common/enums/platform.enum.js';

/** A platform login session (e.g. Bluesky's access + refresh JWTs), encrypted. */
@Entity('provider_sessions')
export class ProviderSession {
  /** Provider-defined key, e.g. `bluesky:https://bsky.social|alice.bsky.social`. */
  @PrimaryColumn({ type: 'varchar', length: 512 })
  key: string;

  @Column({ type: 'enum', enum: Platform })
  platform: Platform;

  @Column({ type: 'text' })
  encryptedData: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
