import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  NotContains,
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
  WEB_ORIGIN =
    'http://localhost:3000,https://abysocials.com,https://www.abysocials.com,https://yosocials.vercel.app';

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
   * Let the AI search the web (Grounding with Google Search). Needs a paid
   * Gemini key: Gemini 3 models get no grounding on the free tier.
   */
  @Transform(toBoolean)
  @IsBoolean()
  GEMINI_SEARCH_GROUNDING = false;

  /** TikTok app credentials from developers.tiktok.com. TikTok stays unavailable until all three are set. */
  @IsOptional()
  @IsString()
  TIKTOK_CLIENT_KEY?: string;

  @IsOptional()
  @IsString()
  TIKTOK_CLIENT_SECRET?: string;

  /** Must match a redirect URI registered on the TikTok app exactly. */
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  TIKTOK_REDIRECT_URI?: string;

  /** Comma-separated scopes; each must be added to the TikTok app. */
  @IsString()
  TIKTOK_SCOPES =
    'user.info.basic,user.info.profile,video.publish,video.upload,video.list';

  /** X app OAuth 2.0 credentials from console.x.com. X stays unavailable until all three are set. */
  @IsOptional()
  @IsString()
  X_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  X_CLIENT_SECRET?: string;

  /** Must match a callback URL registered on the X app exactly. */
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  X_REDIRECT_URI?: string;

  /** Space-separated OAuth 2.0 scopes (X rejects commas and the old read/write permission names). */
  @Matches(/^[a-z.]+( [a-z.]+)*$/, {
    message:
      'X_SCOPES must be space-separated OAuth 2.0 scopes, e.g. "tweet.read tweet.write"',
  })
  X_SCOPES = 'tweet.read tweet.write users.read media.write offline.access';

  /** LinkedIn app credentials (linkedin.com/developers → your app → Auth). LinkedIn stays unavailable until all three are set. */
  @IsOptional()
  @IsString()
  LINKEDIN_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  LINKEDIN_CLIENT_SECRET?: string;

  /** Must match an Authorized redirect URL on the LinkedIn app exactly. */
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  LINKEDIN_REDIRECT_URI?: string;

  /**
   * Space-separated scopes, each granted by a product on the app: openid and
   * profile (Sign In with LinkedIn using OpenID Connect), w_member_social
   * (Share on LinkedIn). Add r_member_postAnalytics once the Community
   * Management API is approved, to read post analytics.
   */
  @Matches(/^[A-Za-z_.]+( [A-Za-z_.]+)*$/, {
    message:
      'LINKEDIN_SCOPES must be space-separated, e.g. "openid profile w_member_social"',
  })
  @NotContains('r_liteprofile', {
    message:
      'LINKEDIN_SCOPES: r_liteprofile and r_emailaddress were retired; use "openid profile"',
  })
  LINKEDIN_SCOPES = 'openid profile w_member_social';

  /** LinkedIn API version (YYYYMM). Each version is retired about a year after release. */
  @Matches(/^\d{6}$/)
  LINKEDIN_API_VERSION = '202611';

  /** UploadThing token (dashboard → API Keys). Media uploads stay off until it's set. */
  @IsOptional()
  @IsString()
  UPLOADTHING_TOKEN?: string;

  /**
   * Public base URL media is served from. The web app proxies `/media/*` to
   * UploadThing, so platforms that pull media (TikTok) see a verified domain.
   */
  @IsUrl({ require_tld: false, require_protocol: true })
  MEDIA_PUBLIC_BASE_URL = 'https://abysocials.com/media';

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
