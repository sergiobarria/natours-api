import { validateEnvironment } from './environment.js';
import { APP_ENVIRONMENT, DATABASE_DEFAULTS } from './config.constants.js';

const databaseEnvironment = {
  DATABASE_URL: 'postgresql://database-user@database-host:5432/database-name',
  REDIS_URL: 'redis://redis-host:6379',
  REDIS_KEY_PREFIX: 'natours-test',
  REDIS_CONNECT_TIMEOUT_MS: '1000',
  REDIS_COMMAND_TIMEOUT_MS: '1000',
  REDIS_MAX_RETRIES_PER_REQUEST: '1',
  JOBS_QUEUE_NAME: 'natours-jobs',
  JOBS_ATTEMPTS: '3',
  JOBS_BACKOFF_DELAY_MS: '1000',
  JOBS_BACKOFF_JITTER: '0.25',
  JOBS_WORKER_CONCURRENCY: '4',
  JOBS_LOCK_DURATION_MS: '30000',
  JOBS_MAX_STALLED_COUNT: '1',
  JOBS_REMOVE_ON_COMPLETE_AGE_SECONDS: '86400',
  JOBS_REMOVE_ON_COMPLETE_COUNT: '1000',
  JOBS_REMOVE_ON_FAIL_AGE_SECONDS: '604800',
  JOBS_REMOVE_ON_FAIL_COUNT: '5000',
  OUTBOX_POLL_INTERVAL_MS: '1000',
  OUTBOX_BATCH_SIZE: '100',
  PROCESS_SHUTDOWN_TIMEOUT_MS: '10000',
  TRUSTED_PROXY_CIDRS: '',
  RATE_LIMIT_GLOBAL_LIMIT: '100',
  RATE_LIMIT_GLOBAL_TTL_MS: '60000',
  RATE_LIMIT_GLOBAL_BLOCK_MS: '60000',
  RATE_LIMIT_AUTH_LIMIT: '10',
  RATE_LIMIT_AUTH_TTL_MS: '60000',
  RATE_LIMIT_AUTH_BLOCK_MS: '300000',
  RATE_LIMIT_ACCOUNT_LIMIT: '30',
  RATE_LIMIT_ACCOUNT_TTL_MS: '60000',
  RATE_LIMIT_ACCOUNT_BLOCK_MS: '60000',
  RATE_LIMIT_WEBHOOK_LIMIT: '120',
  RATE_LIMIT_WEBHOOK_TTL_MS: '60000',
  RATE_LIMIT_WEBHOOK_BLOCK_MS: '60000',
  READINESS_TIMEOUT_MS: '2000',
  WORKER_HEARTBEAT_INTERVAL_MS: '5000',
  SCHEDULER_HEARTBEAT_INTERVAL_MS: '5000',
  PROCESS_HEARTBEAT_TTL_SECONDS: '15',
  HEALTH_SNAPSHOT_SCHEDULE: '*/5 * * * *',
  OPERATIONS_PRUNE_SCHEDULE: '0 3 * * *',
  HEALTH_HISTORY_RETENTION_DAYS: '30',
  APP_URL: 'http://localhost:3000',
  FRONTEND_URL: 'http://localhost:5173',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'test-only-better-auth-secret-32-characters',
  BETTER_AUTH_TRUSTED_ORIGINS: 'http://localhost:5173',
  BETTER_AUTH_SESSION_EXPIRES_IN_SECONDS: '2592000',
  BETTER_AUTH_SESSION_UPDATE_AGE_SECONDS: '86400',
  BETTER_AUTH_VERIFICATION_EXPIRES_IN_SECONDS: '3600',
  BETTER_AUTH_PASSWORD_RESET_EXPIRES_IN_SECONDS: '3600',
  BETTER_AUTH_MIN_PASSWORD_LENGTH: '8',
  BETTER_AUTH_MAX_PASSWORD_LENGTH: '128',
  EMAIL_PROVIDER: 'fake',
  RESEND_API_KEY: 're_test',
  MAIL_FROM_ADDRESS: 'hello@example.com',
  MAIL_FROM_NAME: 'Natours',
};

describe('validateEnvironment', () => {
  it('applies development defaults', () => {
    expect(validateEnvironment(databaseEnvironment)).toEqual({
      NODE_ENV: APP_ENVIRONMENT.development,
      HOST: '0.0.0.0',
      PORT: 3000,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: ['http://localhost:3000', 'http://localhost:5173'],
      DATABASE_URL: databaseEnvironment.DATABASE_URL,
      DATABASE_POOL_MAX: DATABASE_DEFAULTS.poolMax,
      DATABASE_POOL_IDLE_TIMEOUT_MS: DATABASE_DEFAULTS.poolIdleTimeoutMs,
      DATABASE_POOL_CONNECTION_TIMEOUT_MS: DATABASE_DEFAULTS.poolConnectionTimeoutMs,
      REDIS_URL: databaseEnvironment.REDIS_URL,
      REDIS_KEY_PREFIX: databaseEnvironment.REDIS_KEY_PREFIX,
      REDIS_CONNECT_TIMEOUT_MS: 1000,
      REDIS_COMMAND_TIMEOUT_MS: 1000,
      REDIS_MAX_RETRIES_PER_REQUEST: 1,
      JOBS_QUEUE_NAME: databaseEnvironment.JOBS_QUEUE_NAME,
      JOBS_ATTEMPTS: 3,
      JOBS_BACKOFF_DELAY_MS: 1000,
      JOBS_BACKOFF_JITTER: 0.25,
      JOBS_WORKER_CONCURRENCY: 4,
      JOBS_LOCK_DURATION_MS: 30000,
      JOBS_MAX_STALLED_COUNT: 1,
      JOBS_REMOVE_ON_COMPLETE_AGE_SECONDS: 86400,
      JOBS_REMOVE_ON_COMPLETE_COUNT: 1000,
      JOBS_REMOVE_ON_FAIL_AGE_SECONDS: 604800,
      JOBS_REMOVE_ON_FAIL_COUNT: 5000,
      OUTBOX_POLL_INTERVAL_MS: 1000,
      OUTBOX_BATCH_SIZE: 100,
      PROCESS_SHUTDOWN_TIMEOUT_MS: 10000,
      TRUSTED_PROXY_CIDRS: '',
      RATE_LIMIT_GLOBAL_LIMIT: 100,
      RATE_LIMIT_GLOBAL_TTL_MS: 60000,
      RATE_LIMIT_GLOBAL_BLOCK_MS: 60000,
      RATE_LIMIT_AUTH_LIMIT: 10,
      RATE_LIMIT_AUTH_TTL_MS: 60000,
      RATE_LIMIT_AUTH_BLOCK_MS: 300000,
      RATE_LIMIT_ACCOUNT_LIMIT: 30,
      RATE_LIMIT_ACCOUNT_TTL_MS: 60000,
      RATE_LIMIT_ACCOUNT_BLOCK_MS: 60000,
      RATE_LIMIT_WEBHOOK_LIMIT: 120,
      RATE_LIMIT_WEBHOOK_TTL_MS: 60000,
      RATE_LIMIT_WEBHOOK_BLOCK_MS: 60000,
      READINESS_TIMEOUT_MS: 2000,
      WORKER_HEARTBEAT_INTERVAL_MS: 5000,
      SCHEDULER_HEARTBEAT_INTERVAL_MS: 5000,
      PROCESS_HEARTBEAT_TTL_SECONDS: 15,
      HEALTH_SNAPSHOT_SCHEDULE: '*/5 * * * *',
      OPERATIONS_PRUNE_SCHEDULE: '0 3 * * *',
      HEALTH_HISTORY_RETENTION_DAYS: 30,
      APP_URL: databaseEnvironment.APP_URL,
      FRONTEND_URL: databaseEnvironment.FRONTEND_URL,
      BETTER_AUTH_URL: databaseEnvironment.BETTER_AUTH_URL,
      BETTER_AUTH_SECRET: databaseEnvironment.BETTER_AUTH_SECRET,
      BETTER_AUTH_TRUSTED_ORIGINS: databaseEnvironment.BETTER_AUTH_TRUSTED_ORIGINS,
      BETTER_AUTH_SESSION_EXPIRES_IN_SECONDS: 2592000,
      BETTER_AUTH_SESSION_UPDATE_AGE_SECONDS: 86400,
      BETTER_AUTH_VERIFICATION_EXPIRES_IN_SECONDS: 3600,
      BETTER_AUTH_PASSWORD_RESET_EXPIRES_IN_SECONDS: 3600,
      BETTER_AUTH_MIN_PASSWORD_LENGTH: 8,
      BETTER_AUTH_MAX_PASSWORD_LENGTH: 128,
      EMAIL_PROVIDER: 'fake',
      RESEND_API_KEY: 're_test',
      MAIL_FROM_ADDRESS: 'hello@example.com',
      MAIL_FROM_NAME: 'Natours',
    });
  });

  it('coerces the port and parses configured origins', () => {
    const config = validateEnvironment({
      ...databaseEnvironment,
      NODE_ENV: APP_ENVIRONMENT.test,
      PORT: '4000',
      CORS_ORIGINS: 'https://example.com, https://admin.example.com',
    });

    expect(config.PORT).toBe(4000);
    expect(config.CORS_ORIGINS).toEqual(['https://example.com', 'https://admin.example.com']);
  });

  it('rejects invalid ports', () => {
    expect(() => validateEnvironment({ ...databaseEnvironment, PORT: 'not-a-port' })).toThrow();
  });

  it('rejects invalid CORS origins and log levels', () => {
    expect(() =>
      validateEnvironment({ ...databaseEnvironment, CORS_ORIGINS: 'not-a-url' }),
    ).toThrow();
    expect(() => validateEnvironment({ ...databaseEnvironment, LOG_LEVEL: 'verbose' })).toThrow();
  });

  it('requires explicit CORS origins in production', () => {
    expect(() =>
      validateEnvironment({ ...databaseEnvironment, NODE_ENV: APP_ENVIRONMENT.production }),
    ).toThrow('CORS_ORIGINS is required in production');
  });

  it('requires a PostgreSQL database URL', () => {
    expect(() =>
      validateEnvironment({ ...databaseEnvironment, DATABASE_URL: undefined }),
    ).toThrow();
    expect(() => validateEnvironment({ DATABASE_URL: 'https://example.com/database' })).toThrow(
      'DATABASE_URL must use the postgres or postgresql protocol',
    );
  });

  it('requires valid Redis and queue configuration', () => {
    expect(() =>
      validateEnvironment({ ...databaseEnvironment, REDIS_URL: 'https://redis' }),
    ).toThrow('REDIS_URL must use the redis or rediss protocol');
    expect(() =>
      validateEnvironment({ ...databaseEnvironment, JOBS_QUEUE_NAME: 'invalid:name' }),
    ).toThrow('JOBS_QUEUE_NAME may contain letters, numbers, underscores, and hyphens');
  });
});
