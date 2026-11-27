import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import type { LanguageModel } from '../../src/modules/agent/interfaces/language-model.interface.js';

export interface TestApp {
  app: INestApplication<App>;
  http: ReturnType<typeof request>;
  dataSource: DataSource;
  model: LanguageModel & { generateJson: ReturnType<typeof vi.fn> };
  close(): Promise<void>;
}

/**
 * Boots the real AppModule against a fresh in-memory Postgres (PGlite),
 * running every migration, with a fake language model. All env is set
 * explicitly so a developer's api/.env never leaks into tests.
 */
export async function startTestApp(): Promise<TestApp> {
  const port = 20_000 + Math.floor(Math.random() * 20_000);
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({
    db,
    port,
    host: '127.0.0.1',
    maxConnections: 20,
  });
  await server.start();

  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${port}/postgres`,
    DATABASE_SSL: 'false',
    DATABASE_RUN_MIGRATIONS: 'true',
    CREDENTIALS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    JWT_SECRET: randomBytes(32).toString('base64'),
    AUTH_RATE_LIMIT_PER_MINUTE: '10000',
    GEMINI_API_KEY: '',
    SCHEDULER_ENABLED: 'false',
    TIKTOK_CLIENT_KEY: 'test-client-key',
    TIKTOK_CLIENT_SECRET: 'test-client-secret',
    TIKTOK_REDIRECT_URI: 'https://abysocials.test/integrations/tiktok/callback',
    // base64 {"apiKey":"sk_test_fake","appId":"testapp","regions":["sea1"]}
    UPLOADTHING_TOKEN:
      'eyJhcGlLZXkiOiAic2tfdGVzdF9mYWtlIiwgImFwcElkIjogInRlc3RhcHAiLCAicmVnaW9ucyI6IFsic2VhMSJdfQ==',
    MEDIA_PUBLIC_BASE_URL: 'https://abysocials.test/media',
  });

  // Imported after env is set: ConfigModule validates env at import time.
  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp } = await import('../../src/app.setup.js');
  const { LANGUAGE_MODEL } =
    await import('../../src/modules/agent/interfaces/language-model.interface.js');

  const model = { modelName: 'fake-model', generateJson: vi.fn() };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LANGUAGE_MODEL)
    .useValue(model)
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  return {
    app,
    http: request(app.getHttpServer()),
    dataSource: app.get(DataSource),
    model,
    async close() {
      await app.close();
      await server.stop();
      await db.close();
    },
  };
}

export interface SignedUp {
  token: string;
  refreshToken: string;
  userId: string;
  workspaceId: string;
  auth: { Authorization: string };
}

let counter = 0;

/** Signs up a fresh user, who also gets their own workspace. */
export async function signUp(
  http: ReturnType<typeof request>,
  name = `User ${++counter}`,
  email = `user${counter}-${Date.now()}@example.com`,
): Promise<SignedUp> {
  const res = await http
    .post('/api/auth/signup')
    .send({ email, password: 'correct horse battery', name })
    .expect(201);
  const body = res.body as {
    user: { id: string };
    workspace: { id: string };
    tokens: { accessToken: string; refreshToken: string };
  };
  return {
    token: body.tokens.accessToken,
    refreshToken: body.tokens.refreshToken,
    userId: body.user.id,
    workspaceId: body.workspace.id,
    auth: { Authorization: `Bearer ${body.tokens.accessToken}` },
  };
}
