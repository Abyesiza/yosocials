import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkedInPlatform1795857537864 implements MigrationInterface {
  name = 'LinkedInPlatform1795857537864';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // New enum values can't be used inside this transaction, and nothing here does.
    await queryRunner.query(
      `ALTER TYPE "public"."social_accounts_platform_enum" ADD VALUE 'linkedin'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."provider_sessions_platform_enum" ADD VALUE 'linkedin'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rows using the new value can't be cast back to the old types.
    await queryRunner.query(
      `DELETE FROM "social_accounts" WHERE "platform" = 'linkedin'`,
    );
    await queryRunner.query(
      `DELETE FROM "provider_sessions" WHERE "platform" = 'linkedin'`,
    );
    for (const table of ['provider_sessions', 'social_accounts']) {
      await queryRunner.query(
        `CREATE TYPE "public"."${table}_platform_enum_old" AS ENUM('bluesky', 'mastodon', 'telegram', 'discord', 'tiktok', 'x')`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "platform" TYPE "public"."${table}_platform_enum_old" USING "platform"::"text"::"public"."${table}_platform_enum_old"`,
      );
      await queryRunner.query(`DROP TYPE "public"."${table}_platform_enum"`);
      await queryRunner.query(
        `ALTER TYPE "public"."${table}_platform_enum_old" RENAME TO "${table}_platform_enum"`,
      );
    }
  }
}
