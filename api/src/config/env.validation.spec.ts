import { randomBytes } from 'node:crypto';
import { validateEnv } from './env.validation.js';

const baseEnv = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  CREDENTIALS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  JWT_SECRET: randomBytes(32).toString('base64'),
  DATABASE_RUN_MIGRATIONS: 'true',
  SCHEDULER_ENABLED: 'true',
};

describe('validateEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('honours migration and scheduler flags outside Vercel', () => {
    vi.stubEnv('VERCEL', '');
    const env = validateEnv(baseEnv);
    expect(env.DATABASE_RUN_MIGRATIONS).toBe(true);
    expect(env.SCHEDULER_ENABLED).toBe(true);
  });

  it('forces migrations and the scheduler off on Vercel', () => {
    vi.stubEnv('VERCEL', '1');
    const env = validateEnv(baseEnv);
    expect(env.DATABASE_RUN_MIGRATIONS).toBe(false);
    expect(env.SCHEDULER_ENABLED).toBe(false);
  });

  it('names every missing required variable', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });
});
