import { validateEnvironment } from './environment.js';
import { APP_ENVIRONMENT, DATABASE_DEFAULTS } from './config.constants.js';

const databaseEnvironment = {
  DATABASE_URL: 'postgresql://database-user@database-host:5432/database-name',
  REDIS_URL: 'redis://redis-host:6379',
  REDIS_KEY_PREFIX: 'natours-test',
  JOBS_QUEUE_NAME: 'natours-jobs',
  JOBS_WORKER_CONCURRENCY: '4',
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
  APP_URL: 'http://localhost:3000',
  FRONTEND_URL: 'http://localhost:5173',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'test-only-better-auth-secret-32-characters',
  BETTER_AUTH_TRUSTED_ORIGINS: 'http://localhost:5173',
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
      JOBS_QUEUE_NAME: databaseEnvironment.JOBS_QUEUE_NAME,
      JOBS_WORKER_CONCURRENCY: 4,
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
      RATE_LIMIT_BOOKING_LIMIT: 20,
      RATE_LIMIT_BOOKING_TTL_MS: 60000,
      RATE_LIMIT_BOOKING_BLOCK_MS: 60000,
      RATE_LIMIT_REVIEW_LIMIT: 20,
      RATE_LIMIT_REVIEW_TTL_MS: 60000,
      RATE_LIMIT_REVIEW_BLOCK_MS: 60000,
      RATE_LIMIT_WEBHOOK_LIMIT: 120,
      RATE_LIMIT_WEBHOOK_TTL_MS: 60000,
      RATE_LIMIT_WEBHOOK_BLOCK_MS: 60000,
      APP_URL: databaseEnvironment.APP_URL,
      FRONTEND_URL: databaseEnvironment.FRONTEND_URL,
      BETTER_AUTH_URL: databaseEnvironment.BETTER_AUTH_URL,
      BETTER_AUTH_SECRET: databaseEnvironment.BETTER_AUTH_SECRET,
      BETTER_AUTH_TRUSTED_ORIGINS: databaseEnvironment.BETTER_AUTH_TRUSTED_ORIGINS,
      EMAIL_PROVIDER: 'fake',
      RESEND_API_KEY: 're_test',
      MAIL_FROM_ADDRESS: 'hello@example.com',
      MAIL_FROM_NAME: 'Natours',
      OBJECT_STORAGE_PROVIDER: 'fake',
      R2_ACCESS_KEY_ID: '',
      R2_SECRET_ACCESS_KEY: '',
      R2_BUCKET: '',
      R2_ENDPOINT: '',
      R2_PUBLIC_URL: 'http://localhost:3000/media',
      R2_REGION: 'auto',
      PAYMENT_PROVIDER: 'fake',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      STRIPE_CURRENCY: 'usd',
      STRIPE_CHECKOUT_HOLD_MINUTES: 30,
      BOOKING_CANCELLATION_CUTOFF_HOURS: 48,
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

  it('requires a Resend key whenever the Resend provider is selected', () => {
    expect(() =>
      validateEnvironment({
        ...databaseEnvironment,
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: '',
      }),
    ).toThrow('RESEND_API_KEY is required when EMAIL_PROVIDER is resend');
  });

  it('requires the Resend provider in production', () => {
    expect(() =>
      validateEnvironment({
        ...databaseEnvironment,
        NODE_ENV: APP_ENVIRONMENT.production,
        CORS_ORIGINS: 'https://example.com',
        EMAIL_PROVIDER: 'fake',
      }),
    ).toThrow('EMAIL_PROVIDER must be resend in production');
  });

  it('requires complete, valid R2 configuration when selected', () => {
    expect(() =>
      validateEnvironment({ ...databaseEnvironment, OBJECT_STORAGE_PROVIDER: 'r2' }),
    ).toThrow('R2_ACCESS_KEY_ID is required when OBJECT_STORAGE_PROVIDER is r2');
    expect(() =>
      validateEnvironment({
        ...databaseEnvironment,
        OBJECT_STORAGE_PROVIDER: 'r2',
        R2_ACCESS_KEY_ID: 'access',
        R2_SECRET_ACCESS_KEY: 'secret',
        R2_BUCKET: 'bucket',
        R2_ENDPOINT: 'not-a-url',
      }),
    ).toThrow();
  });

  it('requires the R2 provider in production', () => {
    expect(() =>
      validateEnvironment({
        ...databaseEnvironment,
        NODE_ENV: APP_ENVIRONMENT.production,
        CORS_ORIGINS: 'https://example.com',
        EMAIL_PROVIDER: 'resend',
        OBJECT_STORAGE_PROVIDER: 'fake',
      }),
    ).toThrow('OBJECT_STORAGE_PROVIDER must be r2 in production');
  });
});
