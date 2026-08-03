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
    [ENVIRONMENT_VARIABLES.jobsQueueName]: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        'JOBS_QUEUE_NAME may contain letters, numbers, underscores, and hyphens',
      ),
    [ENVIRONMENT_VARIABLES.jobsWorkerConcurrency]: positiveInteger,
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
    [ENVIRONMENT_VARIABLES.appUrl]: originSchema,
    [ENVIRONMENT_VARIABLES.frontendUrl]: originSchema,
    [ENVIRONMENT_VARIABLES.betterAuthUrl]: originSchema,
    [ENVIRONMENT_VARIABLES.betterAuthSecret]: z.string().min(32),
    [ENVIRONMENT_VARIABLES.betterAuthTrustedOrigins]: z.string().trim().min(1),
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

type ParsedEnvironment = z.infer<typeof rawEnvironmentSchema>;
export type Environment = Omit<ParsedEnvironment, 'CORS_ORIGINS'> & { CORS_ORIGINS: string[] };

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
