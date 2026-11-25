import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { EnvironmentVariables } from './config/env.validation.js';

async function bootstrap() {
  // Imported dynamically: ConfigModule validates env while app.module loads,
  // and a static import would throw before the catch below could log it.
  const { AppModule } = await import('./app.module.js');
  const { configureApp } = await import('./app.setup.js');
  // Throw instead of process.abort(), which can kill a serverless function
  // before its logs are flushed.
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  configureApp(app);
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  await app.listen(config.get('PORT', { infer: true }));
}

// Not awaited at the top level: Vercel's launcher waits for this module to
// finish loading before it completes app.listen(), so awaiting the bootstrap
// here deadlocks and the function is killed for an initialization timeout.
bootstrap().catch((error: unknown) => {
  // console.error is always captured by Vercel's function logs.
  console.error('API failed to start:', error);
  process.exit(1);
});
