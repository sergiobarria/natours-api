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
  redisUrl: 'REDIS_URL',
  redisKeyPrefix: 'REDIS_KEY_PREFIX',
  jobsQueueName: 'JOBS_QUEUE_NAME',
  jobsWorkerConcurrency: 'JOBS_WORKER_CONCURRENCY',
  trustedProxyCidrs: 'TRUSTED_PROXY_CIDRS',
  rateLimitGlobalLimit: 'RATE_LIMIT_GLOBAL_LIMIT',
  rateLimitGlobalTtlMs: 'RATE_LIMIT_GLOBAL_TTL_MS',
  rateLimitGlobalBlockMs: 'RATE_LIMIT_GLOBAL_BLOCK_MS',
  rateLimitAuthLimit: 'RATE_LIMIT_AUTH_LIMIT',
  rateLimitAuthTtlMs: 'RATE_LIMIT_AUTH_TTL_MS',
  rateLimitAuthBlockMs: 'RATE_LIMIT_AUTH_BLOCK_MS',
  rateLimitAccountLimit: 'RATE_LIMIT_ACCOUNT_LIMIT',
  rateLimitAccountTtlMs: 'RATE_LIMIT_ACCOUNT_TTL_MS',
  rateLimitAccountBlockMs: 'RATE_LIMIT_ACCOUNT_BLOCK_MS',
  appUrl: 'APP_URL',
  frontendUrl: 'FRONTEND_URL',
  betterAuthUrl: 'BETTER_AUTH_URL',
  betterAuthSecret: 'BETTER_AUTH_SECRET',
  betterAuthTrustedOrigins: 'BETTER_AUTH_TRUSTED_ORIGINS',
  emailProvider: 'EMAIL_PROVIDER',
  resendApiKey: 'RESEND_API_KEY',
  mailFromAddress: 'MAIL_FROM_ADDRESS',
  mailFromName: 'MAIL_FROM_NAME',
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

export const RUNTIME_DEFAULTS = {
  redis: {
    connectTimeoutMs: 5_000,
    commandTimeoutMs: 5_000,
    maxRetriesPerRequest: 1,
  },
  jobs: {
    attempts: 3,
    backoffDelayMs: 1_000,
    backoffJitter: 0.25,
    lockDurationMs: 30_000,
    maxStalledCount: 1,
    removeOnComplete: { age: 86_400, count: 1_000 },
    removeOnFail: { age: 604_800, count: 5_000 },
  },
  outbox: { batchSize: 100, pollIntervalMs: 1_000 },
  processShutdownTimeoutMs: 10_000,
  readinessTimeoutMs: 2_000,
  betterAuth: {
    sessionExpiresInSeconds: 2_592_000,
    sessionUpdateAgeSeconds: 86_400,
    verificationExpiresInSeconds: 3_600,
    passwordResetExpiresInSeconds: 3_600,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
} as const;
