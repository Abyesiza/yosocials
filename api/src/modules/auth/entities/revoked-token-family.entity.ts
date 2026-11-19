import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * A revoked refresh-token family (sign-out, password change, or a reused
 * token). Kept separately from the tokens so revocation also covers tokens
 * of the family saved after it.
 */
@Entity('auth_revoked_token_families')
export class RevokedTokenFamily {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  familyId: string;

  @Column({ type: 'timestamptz' })
  revokedAt: Date;

  /** When the family would have expired anyway; the row can go after this. */
  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;
}
