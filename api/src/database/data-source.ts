/**
 * Data source for the TypeORM CLI (migration:generate / run / revert).
 * The app itself connects through DatabaseModule.
 */
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database-options.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

export default new DataSource(
  databaseOptions({
    DATABASE_URL: url,
    DATABASE_SSL: process.env.DATABASE_SSL === 'true',
  }),
);
