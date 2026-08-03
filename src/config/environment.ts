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
    message: 'CORS origins must use HTTP or HTTPS',
  });

const databaseUrlSchema = z
  .url()
  .refine(url => ['postgres:', 'postgresql:'].includes(new URL(url).protocol), {
    message: 'DATABASE_URL must use the postgres or postgresql protocol',
  });

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
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV === APP_ENVIRONMENT.production && !environment.CORS_ORIGINS?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'CORS_ORIGINS is required in production',
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
