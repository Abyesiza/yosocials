import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * One refresh token, stored by its SHA-256 (the token itself is never kept).
 * Rows are written by TokenService through TypeOrmRefreshTokenStore.
 */
@Entity('auth_refresh_tokens')
export class RefreshToken {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  familyId: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  userId: string;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Index()
  @Column({ type: 'timestamptz' })
  familyExpiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  claims: Record<string, unknown> | null;
}
