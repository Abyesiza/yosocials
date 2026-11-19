import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1795087165021 implements MigrationInterface {
  name = 'InitialSchema1795087165021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."social_accounts_platform_enum" AS ENUM('bluesky', 'mastodon', 'telegram', 'discord')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."social_accounts_persona_enum" AS ENUM('individual', 'influencer', 'company')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."social_accounts_status_enum" AS ENUM('active', 'needs_reconnect')`,
    );
    await queryRunner.query(
      `CREATE TABLE "social_accounts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "platform" "public"."social_accounts_platform_enum" NOT NULL, "externalId" character varying NOT NULL, "handle" character varying NOT NULL, "displayName" character varying NOT NULL, "profileUrl" text, "avatarUrl" text, "persona" "public"."social_accounts_persona_enum" NOT NULL DEFAULT 'individual', "voice" text, "status" "public"."social_accounts_status_enum" NOT NULL DEFAULT 'active', "lastError" text, "encryptedCredentials" text NOT NULL, CONSTRAINT "PK_e9e58d2d8e9fafa20af914d9750" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b47c3fbf58cf3ec8b3a89e02bd" ON "social_accounts"  ("platform", "externalId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."posts_source_enum" AS ENUM('manual', 'agent')`,
    );
    await queryRunner.query(
      `CREATE TABLE "posts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "title" character varying(200), "body" text NOT NULL, "source" "public"."posts_source_enum" NOT NULL DEFAULT 'manual', CONSTRAINT "PK_2829ac61eff60fcec60d7274b9e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."post_targets_status_enum" AS ENUM('draft', 'scheduled', 'publishing', 'published', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "post_targets" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "postId" uuid NOT NULL, "accountId" uuid NOT NULL, "text" text, "status" "public"."post_targets_status_enum" NOT NULL DEFAULT 'draft', "scheduledAt" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT '0', "lastError" text, "externalId" text, "externalUrl" text, "publishedAt" TIMESTAMP WITH TIME ZONE, "likes" integer, "reposts" integer, "replies" integer, "quotes" integer, "views" integer, "metricsUpdatedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_97292747fef778479682f6f022d" UNIQUE ("postId", "accountId"), CONSTRAINT "PK_ab5ca61ef403b13ea38f944bd92" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_362e3257299e4445e2f58dfe48" ON "post_targets"  ("publishedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e15a0a18aa064f379a57e6f5e4" ON "post_targets"  ("status", "scheduledAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "post_metric_snapshots" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "targetId" uuid NOT NULL, "capturedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "likes" integer, "reposts" integer, "replies" integer, "quotes" integer, "views" integer, "raw" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_040d8ba69fd09987b651acde28a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e1de9430ec3b3a1b1b0295a61b" ON "post_metric_snapshots"  ("targetId", "capturedAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "post_targets" ADD CONSTRAINT "FK_65bd62319c8a8fb743d64e2f3ca" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_targets" ADD CONSTRAINT "FK_b49e0a1c4a812ef7a795006592a" FOREIGN KEY ("accountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_metric_snapshots" ADD CONSTRAINT "FK_7443a33e932ce582180a2a3cd29" FOREIGN KEY ("targetId") REFERENCES "post_targets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_metric_snapshots" DROP CONSTRAINT "FK_7443a33e932ce582180a2a3cd29"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_targets" DROP CONSTRAINT "FK_b49e0a1c4a812ef7a795006592a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_targets" DROP CONSTRAINT "FK_65bd62319c8a8fb743d64e2f3ca"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e1de9430ec3b3a1b1b0295a61b"`,
    );
    await queryRunner.query(`DROP TABLE "post_metric_snapshots"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e15a0a18aa064f379a57e6f5e4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_362e3257299e4445e2f58dfe48"`,
    );
    await queryRunner.query(`DROP TABLE "post_targets"`);
    await queryRunner.query(`DROP TYPE "public"."post_targets_status_enum"`);
    await queryRunner.query(`DROP TABLE "posts"`);
    await queryRunner.query(`DROP TYPE "public"."posts_source_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b47c3fbf58cf3ec8b3a89e02bd"`,
    );
    await queryRunner.query(`DROP TABLE "social_accounts"`);
    await queryRunner.query(`DROP TYPE "public"."social_accounts_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."social_accounts_persona_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."social_accounts_platform_enum"`,
    );
  }
}
