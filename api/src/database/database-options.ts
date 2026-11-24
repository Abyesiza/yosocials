import type { DataSourceOptions } from 'typeorm';

type PostgresConnectionOptions = Extract<DataSourceOptions, { type: 'postgres' }>;
import { ENTITIES } from './entities.js';
import { MIGRATIONS } from './migrations/index.js';

export function databaseOptions(env: {
  DATABASE_URL: string;
  DATABASE_SSL: boolean;
}): PostgresConnectionOptions {
  return {
    type: 'postgres',
    url: env.DATABASE_URL,
    // When false, leave it to the URL (e.g. ?sslmode=require) to decide.
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
    // gen_random_uuid() is built into Postgres 13+, no uuid-ossp needed.
    uuidExtension: 'pgcrypto',
    entities: ENTITIES,
    migrations: MIGRATIONS,
    // Schema changes only ever go through migrations.
    synchronize: false,
  };
}
