import { z } from 'zod';
import {
  APP_ENVIRONMENT,
  APP_ENVIRONMENTS,
  DATABASE_DEFAULTS,
  ENVIRONMENT_VARIABLES,
} from './config.constants.js';

const developmentOrigins = ['http://localhost:3000', 'http://localhost:5173'];
const originSchema = z
  .url()
  .refine(origin => ['http:', 'https:'].includes(new URL(origin).protocol), {
    message: 'URL must use the http or https protocol',
  });

const databaseUrlSchema = z
  .url()
  .refine(url => ['postgres:', 'postgresql:'].includes(new URL(url).protocol), {
    message: 'DATABASE_URL must use the postgres or postgresql protocol',
  });

const redisUrlSchema = z
  .url()
  .refine(url => ['redis:', 'rediss:'].includes(new URL(url).protocol), {
    message: 'REDIS_URL must use the redis or rediss protocol',
  });

const positiveInteger = z.coerce.number().int().positive();

const rawEnvironmentSchema = z
  .object({
    [ENVIRONMENT_VARIABLES.nodeEnv]: z.enum(APP_ENVIRONMENTS).default(APP_ENVIRONMENT.development),
    [ENVIRONMENT_VARIABLES.host]: z.string().trim().min(1).default('0.0.0.0'),
    [ENVIRONMENT_VARIABLES.port]: z.coerce.number().int().min(1).max(65_535).default(3000),
    [ENVIRONMENT_VARIABLES.logLevel]: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    [ENVIRONMENT_VARIABLES.corsOrigins]: z.string().optional(),
    [ENVIRONMENT_VARIABLES.databaseUrl]: databaseUrlSchema,
    [ENVIRONMENT_VARIABLES.databasePoolMax]: z.coerce
      .number()
      .int()
      .min(1)
      .max(20)
      .default(DATABASE_DEFAULTS.poolMax),
    [ENVIRONMENT_VARIABLES.databasePoolIdleTimeoutMs]: z.coerce
      .number()
      .int()
      .min(1_000)
      .default(DATABASE_DEFAULTS.poolIdleTimeoutMs),
    [ENVIRONMENT_VARIABLES.databasePoolConnectionTimeoutMs]: z.coerce
      .number()
      .int()
      .min(1_000)
      .default(DATABASE_DEFAULTS.poolConnectionTimeoutMs),
    [ENVIRONMENT_VARIABLES.redisUrl]: redisUrlSchema,
    [ENVIRONMENT_VARIABLES.redisKeyPrefix]: z.string().trim().min(1).max(64),
    [ENVIRONMENT_VARIABLES.redisConnectTimeoutMs]: positiveInteger,
    [ENVIRONMENT_VARIABLES.redisCommandTimeoutMs]: positiveInteger,
    [ENVIRONMENT_VARIABLES.redisMaxRetriesPerRequest]: positiveInteger,
    [ENVIRONMENT_VARIABLES.jobsQueueName]: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        'JOBS_QUEUE_NAME may contain letters, numbers, underscores, and hyphens',
      ),
    [ENVIRONMENT_VARIABLES.jobsAttempts]: positiveInteger.max(100),
    [ENVIRONMENT_VARIABLES.jobsBackoffDelayMs]: positiveInteger,
    [ENVIRONMENT_VARIABLES.jobsBackoffJitter]: z.coerce.number().min(0).max(1),
    [ENVIRONMENT_VARIABLES.jobsWorkerConcurrency]: positiveInteger,
    [ENVIRONMENT_VARIABLES.jobsLockDurationMs]: positiveInteger,
    [ENVIRONMENT_VARIABLES.jobsMaxStalledCount]: z.coerce.number().int().min(0),
    [ENVIRONMENT_VARIABLES.jobsRemoveOnCompleteAgeSeconds]: positiveInteger,
    [ENVIRONMENT_VARIABLES.jobsRemoveOnCompleteCount]: positiveInteger,
    [ENVIRONMENT_VARIABLES.jobsRemoveOnFailAgeSeconds]: positiveInteger,
    [ENVIRONMENT_VARIABLES.jobsRemoveOnFailCount]: positiveInteger,
    [ENVIRONMENT_VARIABLES.outboxPollIntervalMs]: positiveInteger,
    [ENVIRONMENT_VARIABLES.outboxBatchSize]: positiveInteger.max(1_000),
    [ENVIRONMENT_VARIABLES.processShutdownTimeoutMs]: positiveInteger,
    [ENVIRONMENT_VARIABLES.trustedProxyCidrs]: z.string().default(''),
    [ENVIRONMENT_VARIABLES.rateLimitGlobalLimit]: positiveInteger,
    [ENVIRONMENT_VARIABLES.rateLimitGlobalTtlMs]: positiveInteger,
    [ENVIRONMENT_VARIABLES.rateLimitGlobalBlockMs]: positiveInteger,
    [ENVIRONMENT_VARIABLES.rateLimitAuthLimit]: positiveInteger,
    [ENVIRONMENT_VARIABLES.rateLimitAuthTtlMs]: positiveInteger,
    [ENVIRONMENT_VARIABLES.rateLimitAuthBlockMs]: positiveInteger,
    [ENVIRONMENT_VARIABLES.rateLimitAccountLimit]: positiveInteger,
    [ENVIRONMENT_VARIABLES.rateLimitAccountTtlMs]: positiveInteger,
    [ENVIRONMENT_VARIABLES.rateLimitAccountBlockMs]: positiveInteger,
    [ENVIRONMENT_VARIABLES.readinessTimeoutMs]: positiveInteger,
    [ENVIRONMENT_VARIABLES.appUrl]: originSchema,
    [ENVIRONMENT_VARIABLES.frontendUrl]: originSchema,
    [ENVIRONMENT_VARIABLES.betterAuthUrl]: originSchema,
    [ENVIRONMENT_VARIABLES.betterAuthSecret]: z.string().min(32),
    [ENVIRONMENT_VARIABLES.betterAuthTrustedOrigins]: z.string().trim().min(1),
    [ENVIRONMENT_VARIABLES.betterAuthSessionExpiresInSeconds]: positiveInteger,
    [ENVIRONMENT_VARIABLES.betterAuthSessionUpdateAgeSeconds]: positiveInteger,
    [ENVIRONMENT_VARIABLES.betterAuthVerificationExpiresInSeconds]: positiveInteger,
    [ENVIRONMENT_VARIABLES.betterAuthPasswordResetExpiresInSeconds]: positiveInteger,
    [ENVIRONMENT_VARIABLES.betterAuthMinPasswordLength]: positiveInteger,
    [ENVIRONMENT_VARIABLES.betterAuthMaxPasswordLength]: positiveInteger,
    [ENVIRONMENT_VARIABLES.emailProvider]: z.enum(['resend', 'fake']),
    [ENVIRONMENT_VARIABLES.resendApiKey]: z.string().default(''),
    [ENVIRONMENT_VARIABLES.mailFromAddress]: z.email(),
    [ENVIRONMENT_VARIABLES.mailFromName]: z.string().trim().min(1).max(100),
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV === APP_ENVIRONMENT.production && !environment.CORS_ORIGINS?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'CORS_ORIGINS is required in production',
      });
    }
    if (
      environment.BETTER_AUTH_MIN_PASSWORD_LENGTH >= environment.BETTER_AUTH_MAX_PASSWORD_LENGTH
    ) {
      context.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_MAX_PASSWORD_LENGTH'],
        message: 'Maximum password length must exceed minimum password length',
      });
    }
    if (environment.EMAIL_PROVIDER === 'resend' && !environment.RESEND_API_KEY.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'RESEND_API_KEY is required when EMAIL_PROVIDER is resend',
      });
    }
    if (
      environment.NODE_ENV === APP_ENVIRONMENT.production &&
      environment.EMAIL_PROVIDER !== 'resend'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['EMAIL_PROVIDER'],
        message: 'EMAIL_PROVIDER must be resend in production',
      });
    }
  });

export interface Environment {
  NODE_ENV: (typeof APP_ENVIRONMENTS)[number];
  HOST: string;
  PORT: number;
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  CORS_ORIGINS: string[];
  DATABASE_URL: string;
  DATABASE_POOL_MAX: number;
  DATABASE_POOL_IDLE_TIMEOUT_MS: number;
  DATABASE_POOL_CONNECTION_TIMEOUT_MS: number;
  REDIS_URL: string;
  REDIS_KEY_PREFIX: string;
  REDIS_CONNECT_TIMEOUT_MS: number;
  REDIS_COMMAND_TIMEOUT_MS: number;
  REDIS_MAX_RETRIES_PER_REQUEST: number;
  JOBS_QUEUE_NAME: string;
  JOBS_ATTEMPTS: number;
  JOBS_BACKOFF_DELAY_MS: number;
  JOBS_BACKOFF_JITTER: number;
  JOBS_WORKER_CONCURRENCY: number;
  JOBS_LOCK_DURATION_MS: number;
  JOBS_MAX_STALLED_COUNT: number;
  JOBS_REMOVE_ON_COMPLETE_AGE_SECONDS: number;
  JOBS_REMOVE_ON_COMPLETE_COUNT: number;
  JOBS_REMOVE_ON_FAIL_AGE_SECONDS: number;
  JOBS_REMOVE_ON_FAIL_COUNT: number;
  OUTBOX_POLL_INTERVAL_MS: number;
  OUTBOX_BATCH_SIZE: number;
  PROCESS_SHUTDOWN_TIMEOUT_MS: number;
  TRUSTED_PROXY_CIDRS: string;
  RATE_LIMIT_GLOBAL_LIMIT: number;
  RATE_LIMIT_GLOBAL_TTL_MS: number;
  RATE_LIMIT_GLOBAL_BLOCK_MS: number;
  RATE_LIMIT_AUTH_LIMIT: number;
  RATE_LIMIT_AUTH_TTL_MS: number;
  RATE_LIMIT_AUTH_BLOCK_MS: number;
  RATE_LIMIT_ACCOUNT_LIMIT: number;
  RATE_LIMIT_ACCOUNT_TTL_MS: number;
  RATE_LIMIT_ACCOUNT_BLOCK_MS: number;
  READINESS_TIMEOUT_MS: number;
  APP_URL: string;
  FRONTEND_URL: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_TRUSTED_ORIGINS: string;
  BETTER_AUTH_SESSION_EXPIRES_IN_SECONDS: number;
  BETTER_AUTH_SESSION_UPDATE_AGE_SECONDS: number;
  BETTER_AUTH_VERIFICATION_EXPIRES_IN_SECONDS: number;
  BETTER_AUTH_PASSWORD_RESET_EXPIRES_IN_SECONDS: number;
  BETTER_AUTH_MIN_PASSWORD_LENGTH: number;
  BETTER_AUTH_MAX_PASSWORD_LENGTH: number;
  EMAIL_PROVIDER: 'resend' | 'fake';
  RESEND_API_KEY: string;
  MAIL_FROM_ADDRESS: string;
  MAIL_FROM_NAME: string;
}

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const parsed = rawEnvironmentSchema.parse(config);
  const origins = parsed.CORS_ORIGINS
    ? parsed.CORS_ORIGINS.split(',')
        .map(origin => origin.trim())
        .filter(Boolean)
    : developmentOrigins;

  return {
    ...parsed,
    CORS_ORIGINS: z.array(originSchema).min(1).parse(origins),
  };
}
