import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsersAndWorkspaces1795091215267 implements MigrationInterface {
  name = 'UsersAndWorkspaces1795091215267';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Accounts and posts gain a required workspaceId. There is no
    // workspace to assign existing rows to, so refuse to run on data.
    const [{ n }] = await queryRunner.query(
      `SELECT (SELECT count(*) FROM social_accounts) + (SELECT count(*) FROM posts) AS n`,
    );
    if (Number(n) > 0) {
      throw new Error(
        'UsersAndWorkspaces: social_accounts/posts must be empty; assign them to a workspace first',
      );
    }
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b47c3fbf58cf3ec8b3a89e02bd"`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(320) NOT NULL, "name" character varying(120) NOT NULL, "passwordHash" text NOT NULL, "lastSignInAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."workspace_members_role_enum" AS ENUM('owner', 'admin', 'editor', 'viewer')`,
    );
    await queryRunner.query(
      `CREATE TABLE "workspace_members" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "workspaceId" uuid NOT NULL, "userId" uuid NOT NULL, "role" "public"."workspace_members_role_enum" NOT NULL, CONSTRAINT "UQ_99bcb5fdac446371d41f048b24f" UNIQUE ("workspaceId", "userId"), CONSTRAINT "PK_22ab43ac5865cd62769121d2bc4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_22176b38813258c2aadaae3244" ON "workspace_members"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "workspaces" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(120) NOT NULL, CONSTRAINT "PK_098656ae401f3e1a4586f47fd8e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_refresh_tokens" ("id" character varying(128) NOT NULL, "familyId" character varying(128) NOT NULL, "userId" character varying(128) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "familyExpiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, "claims" jsonb, CONSTRAINT "PK_df6893d2063a4ea7bbf1eda31e5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f2435c12b641c8c901bd6e8b55" ON "auth_refresh_tokens"  ("familyId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4cee0cefed5da7cdacff696683" ON "auth_refresh_tokens"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bb4b299be30c3ba6de25e1fdef" ON "auth_refresh_tokens"  ("familyExpiresAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_revoked_token_families" ("familyId" character varying(128) NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_b9d6802048f23a1385f12f260b5" PRIMARY KEY ("familyId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3531dea8098c1fb6667bef9745" ON "auth_revoked_token_families"  ("expiresAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "social_accounts" ADD "workspaceId" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD "workspaceId" uuid NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "posts" ADD "createdById" uuid`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0b39f3846d219611e92a474adb" ON "social_accounts"  ("workspaceId", "platform", "externalId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5a43d0ba3898d4500da70c03d9" ON "posts"  ("workspaceId", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_members" ADD CONSTRAINT "FK_0dd45cb52108d0664df4e7e33e6" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_members" ADD CONSTRAINT "FK_22176b38813258c2aadaae32448" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "social_accounts" ADD CONSTRAINT "FK_b9cdb5dc4e76553c7e1336edf42" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD CONSTRAINT "FK_84defbbc1e3bfe3819c43f94028" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" ADD CONSTRAINT "FK_14ee02b0fe49a09d1bcee6ce5ba" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "posts" DROP CONSTRAINT "FK_14ee02b0fe49a09d1bcee6ce5ba"`,
    );
    await queryRunner.query(
      `ALTER TABLE "posts" DROP CONSTRAINT "FK_84defbbc1e3bfe3819c43f94028"`,
    );
    await queryRunner.query(
      `ALTER TABLE "social_accounts" DROP CONSTRAINT "FK_b9cdb5dc4e76553c7e1336edf42"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_members" DROP CONSTRAINT "FK_22176b38813258c2aadaae32448"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_members" DROP CONSTRAINT "FK_0dd45cb52108d0664df4e7e33e6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5a43d0ba3898d4500da70c03d9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0b39f3846d219611e92a474adb"`,
    );
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "createdById"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "workspaceId"`);
    await queryRunner.query(
      `ALTER TABLE "social_accounts" DROP COLUMN "workspaceId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3531dea8098c1fb6667bef9745"`,
    );
    await queryRunner.query(`DROP TABLE "auth_revoked_token_families"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bb4b299be30c3ba6de25e1fdef"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4cee0cefed5da7cdacff696683"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f2435c12b641c8c901bd6e8b55"`,
    );
    await queryRunner.query(`DROP TABLE "auth_refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "workspaces"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_22176b38813258c2aadaae3244"`,
    );
    await queryRunner.query(`DROP TABLE "workspace_members"`);
    await queryRunner.query(`DROP TYPE "public"."workspace_members_role_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b47c3fbf58cf3ec8b3a89e02bd" ON "social_accounts" USING btree ("externalId", "platform") `,
    );
  }
}
