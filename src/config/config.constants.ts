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
  redisConnectTimeoutMs: 'REDIS_CONNECT_TIMEOUT_MS',
  redisCommandTimeoutMs: 'REDIS_COMMAND_TIMEOUT_MS',
  redisMaxRetriesPerRequest: 'REDIS_MAX_RETRIES_PER_REQUEST',
  jobsQueueName: 'JOBS_QUEUE_NAME',
  jobsAttempts: 'JOBS_ATTEMPTS',
  jobsBackoffDelayMs: 'JOBS_BACKOFF_DELAY_MS',
  jobsBackoffJitter: 'JOBS_BACKOFF_JITTER',
  jobsWorkerConcurrency: 'JOBS_WORKER_CONCURRENCY',
  jobsLockDurationMs: 'JOBS_LOCK_DURATION_MS',
  jobsMaxStalledCount: 'JOBS_MAX_STALLED_COUNT',
  jobsRemoveOnCompleteAgeSeconds: 'JOBS_REMOVE_ON_COMPLETE_AGE_SECONDS',
  jobsRemoveOnCompleteCount: 'JOBS_REMOVE_ON_COMPLETE_COUNT',
  jobsRemoveOnFailAgeSeconds: 'JOBS_REMOVE_ON_FAIL_AGE_SECONDS',
  jobsRemoveOnFailCount: 'JOBS_REMOVE_ON_FAIL_COUNT',
  outboxPollIntervalMs: 'OUTBOX_POLL_INTERVAL_MS',
  outboxBatchSize: 'OUTBOX_BATCH_SIZE',
  processShutdownTimeoutMs: 'PROCESS_SHUTDOWN_TIMEOUT_MS',
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
