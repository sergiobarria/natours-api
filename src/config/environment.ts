import { z } from 'zod';
import { ENVIRONMENT_VARIABLES } from './config.constants';

const developmentOrigins = ['http://localhost:3000', 'http://localhost:5173'];
const originSchema = z
  .url()
  .refine(origin => ['http:', 'https:'].includes(new URL(origin).protocol), {
    message: 'CORS origins must use HTTP or HTTPS',
  });

const rawEnvironmentSchema = z
  .object({
    [ENVIRONMENT_VARIABLES.nodeEnv]: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    [ENVIRONMENT_VARIABLES.host]: z.string().trim().min(1).default('0.0.0.0'),
    [ENVIRONMENT_VARIABLES.port]: z.coerce.number().int().min(1).max(65_535).default(3000),
    [ENVIRONMENT_VARIABLES.logLevel]: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    [ENVIRONMENT_VARIABLES.corsOrigins]: z.string().optional(),
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV === 'production' && !environment.CORS_ORIGINS?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'CORS_ORIGINS is required in production',
      });
    }
  });

export interface Environment {
  NODE_ENV: 'development' | 'test' | 'production';
  HOST: string;
  PORT: number;
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  CORS_ORIGINS: string[];
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
