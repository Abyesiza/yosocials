import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity.js';

@Entity('users')
export class User extends BaseEntity {
  /** Always stored trimmed and lowercased, so lookups are exact. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 320 })
  email: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** scrypt hash from PasswordHasher. Never selected unless asked for. */
  @Column({ type: 'text', select: false })
  passwordHash: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastSignInAt: Date | null;
}
