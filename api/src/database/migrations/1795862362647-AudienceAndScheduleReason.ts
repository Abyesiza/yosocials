import { MigrationInterface, QueryRunner } from 'typeorm';

export class AudienceAndScheduleReason1795862362647 implements MigrationInterface {
  name = 'AudienceAndScheduleReason1795862362647';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD "audienceCountry" character varying(2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD "audienceTimeZone" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_targets" ADD "scheduleReason" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_targets" DROP COLUMN "scheduleReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" DROP COLUMN "audienceTimeZone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" DROP COLUMN "audienceCountry"`,
    );
  }
}
