import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

const toBoolean = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.toLowerCase() === 'true' : value;

/**
 * Every environment variable the API reads. The app refuses to start when one
 * is missing or malformed, so misconfiguration fails loudly at boot instead of
 * on the first request.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000;

  /** Origin of the Next.js web app, allowed through CORS. */
  @IsString()
  WEB_ORIGIN = 'http://localhost:3000,https://abysocials.com,https://www.abysocials.com,https://yosocials.vercel.app';

  /** Postgres connection string, e.g. postgres://user:pass@host:5432/db */
  @IsString()
  @Matches(/^postgres(ql)?:\/\//, {
    message: 'DATABASE_URL must be a postgres:// connection string',
  })
  DATABASE_URL: string;

  @Transform(toBoolean)
  @IsBoolean()
  DATABASE_SSL = false;

  /** Run pending migrations at startup. Always off on Vercel. */
  @Transform(toBoolean)
  @IsBoolean()
  DATABASE_RUN_MIGRATIONS = true;

  /**
   * 32-byte key, base64 encoded, used to encrypt platform credentials at rest.
   * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   */
  @IsString()
  @MinLength(44)
  CREDENTIALS_ENCRYPTION_KEY: string;

  /**
   * Signs access tokens (HS256). 32+ random bytes, base64 encoded; generate
   * it the same way as CREDENTIALS_ENCRYPTION_KEY. Changing it signs
   * everyone out.
   */
  @IsString()
  @MinLength(44)
  JWT_SECRET: string;

  /** Sign-in/sign-up attempts allowed per IP per minute. */
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  AUTH_RATE_LIMIT_PER_MINUTE = 10;

  @IsOptional()
  @IsString()
  GEMINI_API_KEY?: string;

  /** First model the agent tries. */
  @IsString()
  GEMINI_MODEL = 'gemini-3.5-flash-lite';

  /** Comma-separated models to try, in order, when one is overloaded or slow. */
  @IsOptional()
  @IsString()
  GEMINI_FALLBACK_MODELS?: string = 'gemini-3.8-flash';

  /**
   * Turn the publish/metrics cron jobs off, e.g. on extra API replicas.
   * Always off on Vercel.
   */
  @Transform(toBoolean)
  @IsBoolean()
  SCHEDULER_ENABLED = true;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${details}`);
  }
  if (isServerless()) {
    // A Vercel function is a short-lived, concurrent instance: migrating on
    // every cold start races other instances and delays the first request,
    // and in-process cron never fires while the function sleeps. Force both
    // off even when copied env says otherwise; run migrations from the CLI.
    validated.DATABASE_RUN_MIGRATIONS = false;
    validated.SCHEDULER_ENABLED = false;
  }
  return validated;
}

/** True inside a Vercel function. */
export function isServerless(): boolean {
  return process.env.VERCEL === '1';
}
