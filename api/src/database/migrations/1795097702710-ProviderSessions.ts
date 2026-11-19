import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProviderSessions1795097702710 implements MigrationInterface {
  name = 'ProviderSessions1795097702710';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."provider_sessions_platform_enum" AS ENUM('bluesky', 'mastodon', 'telegram', 'discord')`,
    );
    await queryRunner.query(
      `CREATE TABLE "provider_sessions" ("key" character varying(512) NOT NULL, "platform" "public"."provider_sessions_platform_enum" NOT NULL, "encryptedData" text NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_366cfd2ca1409816c290a11aa90" PRIMARY KEY ("key"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "provider_sessions"`);
    await queryRunner.query(
      `DROP TYPE "public"."provider_sessions_platform_enum"`,
    );
  }
}
