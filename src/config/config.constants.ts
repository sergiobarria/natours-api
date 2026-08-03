export const ENVIRONMENT_VARIABLES = {
  nodeEnv: 'NODE_ENV',
  host: 'HOST',
  port: 'PORT',
  logLevel: 'LOG_LEVEL',
  corsOrigins: 'CORS_ORIGINS',
  databaseUrl: 'DATABASE_URL',
  databasePoolMax: 'DATABASE_POOL_MAX',
  databasePoolIdleTimeoutMs: 'DATABASE_POOL_IDLE_TIMEOUT_MS',
  databasePoolConnectionTimeoutMs: 'DATABASE_POOL_CONNECTION_TIMEOUT_MS',
} as const;

export const APP_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export const APP_ENVIRONMENT = {
  development: APP_ENVIRONMENTS[0],
  test: APP_ENVIRONMENTS[1],
  production: APP_ENVIRONMENTS[2],
} as const;

export const DATABASE_DEFAULTS = {
  poolMax: 10,
  poolIdleTimeoutMs: 30_000,
  poolConnectionTimeoutMs: 5_000,
} as const;
