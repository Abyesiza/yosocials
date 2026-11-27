import { MigrationInterface, QueryRunner } from 'typeorm';

export class TikTokAndMedia1795813463918 implements MigrationInterface {
  name = 'TikTokAndMedia1795813463918';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "posts" ADD "media" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(`ALTER TABLE "post_targets" ADD "options" jsonb`);
    // New enum values can't be used inside this transaction, and nothing here does.
    await queryRunner.query(
      `ALTER TYPE "public"."social_accounts_platform_enum" ADD VALUE 'tiktok'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."provider_sessions_platform_enum" ADD VALUE 'tiktok'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."post_targets_status_enum" ADD VALUE 'processing'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rows using the new values can't be cast back to the old types.
    await queryRunner.query(
      `DELETE FROM "social_accounts" WHERE "platform" = 'tiktok'`,
    );
    await queryRunner.query(
      `DELETE FROM "provider_sessions" WHERE "platform" = 'tiktok'`,
    );
    await queryRunner.query(
      `UPDATE "post_targets" SET "status" = 'failed' WHERE "status" = 'processing'`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."post_targets_status_enum_old" AS ENUM('draft', 'scheduled', 'publishing', 'published', 'failed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_targets" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_targets" ALTER COLUMN "status" TYPE "public"."post_targets_status_enum_old" USING "status"::"text"::"public"."post_targets_status_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."post_targets_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."post_targets_status_enum_old" RENAME TO "post_targets_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_targets" ALTER COLUMN "status" SET DEFAULT 'draft'`,
    );

    for (const table of ['provider_sessions', 'social_accounts']) {
      await queryRunner.query(
        `CREATE TYPE "public"."${table}_platform_enum_old" AS ENUM('bluesky', 'mastodon', 'telegram', 'discord')`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "platform" TYPE "public"."${table}_platform_enum_old" USING "platform"::"text"::"public"."${table}_platform_enum_old"`,
      );
      await queryRunner.query(`DROP TYPE "public"."${table}_platform_enum"`);
      await queryRunner.query(
        `ALTER TYPE "public"."${table}_platform_enum_old" RENAME TO "${table}_platform_enum"`,
      );
    }

    await queryRunner.query(`ALTER TABLE "post_targets" DROP COLUMN "options"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "media"`);
  }
}
