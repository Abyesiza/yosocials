import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  type EnvironmentVariables,
  isServerless,
} from '../config/env.validation.js';
import { databaseOptions } from './database-options.js';

const SERVERLESS = isServerless();

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        ...databaseOptions({
          DATABASE_URL: config.get('DATABASE_URL', { infer: true }),
          DATABASE_SSL: config.get('DATABASE_SSL', { infer: true }),
        }),
        migrationsRun: config.get('DATABASE_RUN_MIGRATIONS', { infer: true }),
        // Without a timeout pg waits forever on an unreachable host, and the
        // default 9 retries x 3s stall serverless cold starts for 30s+ before
        // the real error surfaces. Fail fast on Vercel so it shows in logs.
        connectTimeoutMS: 10_000,
        retryAttempts: SERVERLESS ? 1 : 9,
        retryDelay: SERVERLESS ? 500 : 3000,
        // Many short-lived instances share the Supabase pooler; keep each small.
        poolSize: SERVERLESS ? 3 : 10,
      }),
    }),
  ],
})
export class DatabaseModule {}
