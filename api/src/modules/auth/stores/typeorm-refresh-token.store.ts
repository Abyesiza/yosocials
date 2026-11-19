import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type RefreshTokenRecord,
  type RefreshTokenStore,
} from '@nestjs/authentication';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThan } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { RevokedTokenFamily } from '../entities/revoked-token-family.entity.js';

/**
 * Postgres storage for @nestjs/authentication's refresh tokens. Checked
 * against the package's own contract suite in the e2e tests.
 */
@Injectable()
export class TypeOrmRefreshTokenStore implements RefreshTokenStore {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    storage?: AuthenticationStorage,
  ) {
    storage?.registerSource({ refreshTokens: this });
  }

  private get tokens() {
    return this.dataSource.getRepository(RefreshToken);
  }

  private get revoked() {
    return this.dataSource.getRepository(RevokedTokenFamily);
  }

  async getRefreshToken(id: string): Promise<RefreshTokenRecord | undefined> {
    const row = await this.tokens.findOneBy({ id });
    if (!row) return undefined;
    return {
      id: row.id,
      familyId: row.familyId,
      userId: row.userId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      familyExpiresAt: row.familyExpiresAt,
      // Optional fields come back absent, never null.
      ...(row.usedAt && { usedAt: row.usedAt }),
      ...(row.claims && { claims: row.claims }),
    };
  }

  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    // Ids are fresh random hashes, so this always inserts.
    await this.tokens.save(
      this.tokens.create({
        id: record.id,
        familyId: record.familyId,
        userId: record.userId,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        familyExpiresAt: record.familyExpiresAt,
        usedAt: record.usedAt ?? null,
        claims: record.claims ?? null,
      }),
    );
    // Keep the tables bounded: families past their absolute lifetime can't
    // be used or extended, so neither they nor their revocations matter.
    await this.tokens.delete({ familyExpiresAt: LessThan(record.createdAt) });
    await this.revoked.delete({ expiresAt: LessThan(record.createdAt) });
  }

  /** One conditional write: of concurrent callers, exactly one wins. */
  async markRefreshTokenUsed(id: string, at: Date): Promise<boolean> {
    const result = await this.tokens.update(
      { id, usedAt: IsNull() },
      { usedAt: at },
    );
    return result.affected === 1;
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO auth_revoked_token_families ("familyId", "revokedAt", "expiresAt")
       SELECT $1::varchar, now(), (SELECT max("familyExpiresAt") FROM auth_refresh_tokens WHERE "familyId" = $1::varchar)
       ON CONFLICT ("familyId") DO NOTHING`,
      [familyId],
    );
  }

  async isRefreshTokenFamilyRevoked(familyId: string): Promise<boolean> {
    return this.revoked.existsBy({ familyId });
  }

  async revokeUserRefreshTokens(userId: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO auth_revoked_token_families ("familyId", "revokedAt", "expiresAt")
       SELECT "familyId", now(), max("familyExpiresAt")
         FROM auth_refresh_tokens WHERE "userId" = $1
        GROUP BY "familyId"
       ON CONFLICT ("familyId") DO NOTHING`,
      [userId],
    );
  }
}
