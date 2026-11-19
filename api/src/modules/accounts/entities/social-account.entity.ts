import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity.js';
import { Platform } from '../../../common/enums/platform.enum.js';
import { Workspace } from '../../workspaces/entities/workspace.entity.js';
import { AccountPersona } from '../enums/account-persona.enum.js';
import { AccountStatus } from '../enums/account-status.enum.js';

@Entity('social_accounts')
// The same platform account can be connected once per workspace.
@Index(['workspaceId', 'platform', 'externalId'], { unique: true })
export class SocialAccount extends BaseEntity {
  @Column('uuid')
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Relation<Workspace>;

  @Column({ type: 'enum', enum: Platform })
  platform: Platform;

  /** The platform's own id for the account/channel. */
  @Column()
  externalId: string;

  @Column()
  handle: string;

  @Column()
  displayName: string;

  @Column({ type: 'text', nullable: true })
  profileUrl: string | null;

  @Column({ type: 'text', nullable: true })
  avatarUrl: string | null;

  /** Drives the agent's tone and rules for this account. */
  @Column({
    type: 'enum',
    enum: AccountPersona,
    default: AccountPersona.Individual,
  })
  persona: AccountPersona;

  /** Free-text brand voice notes, passed to the agent. */
  @Column({ type: 'text', nullable: true })
  voice: string | null;

  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.Active })
  status: AccountStatus;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  /** AES-256-GCM ciphertext. Never selected unless asked for explicitly. */
  @Column({ type: 'text', select: false })
  encryptedCredentials: string;
}
