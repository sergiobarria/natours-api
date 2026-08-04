import { APP_ENVIRONMENT, RUNTIME_DEFAULTS } from './config.constants.js';
import type { Environment } from './environment.js';

export class AppConfigService {
  readonly environment: Environment['NODE_ENV'];
  readonly host: string;
  readonly port: number;
  readonly logLevel: Environment['LOG_LEVEL'];
  readonly corsOrigins: string[];
  readonly databaseUrl: string;
  readonly databasePoolMax: number;
  readonly databasePoolIdleTimeoutMs: number;
  readonly databasePoolConnectionTimeoutMs: number;
  readonly redisUrl: string;
  readonly redisKeyPrefix: string;
  readonly redisConnectTimeoutMs: number;
  readonly redisCommandTimeoutMs: number;
  readonly redisMaxRetriesPerRequest: number;
  readonly jobsQueueName: string;
  readonly jobsAttempts: number;
  readonly jobsBackoffDelayMs: number;
  readonly jobsBackoffJitter: number;
  readonly jobsWorkerConcurrency: number;
  readonly jobsLockDurationMs: number;
  readonly jobsMaxStalledCount: number;
  readonly jobsRemoveOnComplete: { age: number; count: number };
  readonly jobsRemoveOnFail: { age: number; count: number };
  readonly outboxPollIntervalMs: number;
  readonly outboxBatchSize: number;
  readonly processShutdownTimeoutMs: number;
  readonly trustedProxyCidrs: string[];
  readonly rateLimits: {
    global: { limit: number; ttl: number; blockDuration: number };
    authentication: { limit: number; ttl: number; blockDuration: number };
    account: { limit: number; ttl: number; blockDuration: number };
    booking: { limit: number; ttl: number; blockDuration: number };
    webhook: { limit: number; ttl: number; blockDuration: number };
  };
  readonly readinessTimeoutMs: number;
  readonly appUrl: string;
  readonly frontendUrl: string;
  readonly betterAuthUrl: string;
  readonly betterAuthSecret: string;
  readonly betterAuthTrustedOrigins: string[];
  readonly betterAuthSessionExpiresInSeconds: number;
  readonly betterAuthSessionUpdateAgeSeconds: number;
  readonly betterAuthVerificationExpiresInSeconds: number;
  readonly betterAuthPasswordResetExpiresInSeconds: number;
  readonly betterAuthMinPasswordLength: number;
  readonly betterAuthMaxPasswordLength: number;
  readonly emailProvider: Environment['EMAIL_PROVIDER'];
  readonly resendApiKey: string;
  readonly mailFromAddress: string;
  readonly mailFromName: string;
  readonly objectStorageProvider: Environment['OBJECT_STORAGE_PROVIDER'];
  readonly r2AccessKeyId: string;
  readonly r2SecretAccessKey: string;
  readonly r2Bucket: string;
  readonly r2Endpoint: string;
  readonly r2PublicUrl: string;
  readonly r2Region: string;
  readonly paymentProvider: Environment['PAYMENT_PROVIDER'];
  readonly stripeSecretKey: string;
  readonly stripeWebhookSecret: string;
  readonly stripeCurrency: 'usd';
  readonly stripeCheckoutHoldMinutes: number;
  readonly bookingCancellationCutoffHours: number;

  constructor(environment: Environment) {
    this.environment = environment.NODE_ENV;
    this.host = environment.HOST;
    this.port = environment.PORT;
    this.logLevel = environment.LOG_LEVEL;
    this.corsOrigins = environment.CORS_ORIGINS;
    this.databaseUrl = environment.DATABASE_URL;
    this.databasePoolMax = environment.DATABASE_POOL_MAX;
    this.databasePoolIdleTimeoutMs = environment.DATABASE_POOL_IDLE_TIMEOUT_MS;
    this.databasePoolConnectionTimeoutMs = environment.DATABASE_POOL_CONNECTION_TIMEOUT_MS;
    this.redisUrl = environment.REDIS_URL;
    this.redisKeyPrefix = environment.REDIS_KEY_PREFIX;
    this.redisConnectTimeoutMs = RUNTIME_DEFAULTS.redis.connectTimeoutMs;
    this.redisCommandTimeoutMs = RUNTIME_DEFAULTS.redis.commandTimeoutMs;
    this.redisMaxRetriesPerRequest = RUNTIME_DEFAULTS.redis.maxRetriesPerRequest;
    this.jobsQueueName = environment.JOBS_QUEUE_NAME;
    this.jobsAttempts = RUNTIME_DEFAULTS.jobs.attempts;
    this.jobsBackoffDelayMs = RUNTIME_DEFAULTS.jobs.backoffDelayMs;
    this.jobsBackoffJitter = RUNTIME_DEFAULTS.jobs.backoffJitter;
    this.jobsWorkerConcurrency = environment.JOBS_WORKER_CONCURRENCY;
    this.jobsLockDurationMs = RUNTIME_DEFAULTS.jobs.lockDurationMs;
    this.jobsMaxStalledCount = RUNTIME_DEFAULTS.jobs.maxStalledCount;
    this.jobsRemoveOnComplete = RUNTIME_DEFAULTS.jobs.removeOnComplete;
    this.jobsRemoveOnFail = RUNTIME_DEFAULTS.jobs.removeOnFail;
    this.outboxPollIntervalMs = RUNTIME_DEFAULTS.outbox.pollIntervalMs;
    this.outboxBatchSize = RUNTIME_DEFAULTS.outbox.batchSize;
    this.processShutdownTimeoutMs = RUNTIME_DEFAULTS.processShutdownTimeoutMs;
    this.trustedProxyCidrs = splitList(environment.TRUSTED_PROXY_CIDRS);
    this.rateLimits = {
      global: rateLimit(
        environment.RATE_LIMIT_GLOBAL_LIMIT,
        environment.RATE_LIMIT_GLOBAL_TTL_MS,
        environment.RATE_LIMIT_GLOBAL_BLOCK_MS,
      ),
      authentication: rateLimit(
        environment.RATE_LIMIT_AUTH_LIMIT,
        environment.RATE_LIMIT_AUTH_TTL_MS,
        environment.RATE_LIMIT_AUTH_BLOCK_MS,
      ),
      account: rateLimit(
        environment.RATE_LIMIT_ACCOUNT_LIMIT,
        environment.RATE_LIMIT_ACCOUNT_TTL_MS,
        environment.RATE_LIMIT_ACCOUNT_BLOCK_MS,
      ),
      booking: rateLimit(
        environment.RATE_LIMIT_BOOKING_LIMIT,
        environment.RATE_LIMIT_BOOKING_TTL_MS,
        environment.RATE_LIMIT_BOOKING_BLOCK_MS,
      ),
      webhook: rateLimit(
        environment.RATE_LIMIT_WEBHOOK_LIMIT,
        environment.RATE_LIMIT_WEBHOOK_TTL_MS,
        environment.RATE_LIMIT_WEBHOOK_BLOCK_MS,
      ),
    };
    this.readinessTimeoutMs = RUNTIME_DEFAULTS.readinessTimeoutMs;
    this.appUrl = environment.APP_URL;
    this.frontendUrl = environment.FRONTEND_URL;
    this.betterAuthUrl = environment.BETTER_AUTH_URL;
    this.betterAuthSecret = environment.BETTER_AUTH_SECRET;
    this.betterAuthTrustedOrigins = splitList(environment.BETTER_AUTH_TRUSTED_ORIGINS);
    this.betterAuthSessionExpiresInSeconds = RUNTIME_DEFAULTS.betterAuth.sessionExpiresInSeconds;
    this.betterAuthSessionUpdateAgeSeconds = RUNTIME_DEFAULTS.betterAuth.sessionUpdateAgeSeconds;
    this.betterAuthVerificationExpiresInSeconds =
      RUNTIME_DEFAULTS.betterAuth.verificationExpiresInSeconds;
    this.betterAuthPasswordResetExpiresInSeconds =
      RUNTIME_DEFAULTS.betterAuth.passwordResetExpiresInSeconds;
    this.betterAuthMinPasswordLength = RUNTIME_DEFAULTS.betterAuth.minPasswordLength;
    this.betterAuthMaxPasswordLength = RUNTIME_DEFAULTS.betterAuth.maxPasswordLength;
    this.emailProvider = environment.EMAIL_PROVIDER;
    this.resendApiKey = environment.RESEND_API_KEY;
    this.mailFromAddress = environment.MAIL_FROM_ADDRESS;
    this.mailFromName = environment.MAIL_FROM_NAME;
    this.objectStorageProvider = environment.OBJECT_STORAGE_PROVIDER;
    this.r2AccessKeyId = environment.R2_ACCESS_KEY_ID;
    this.r2SecretAccessKey = environment.R2_SECRET_ACCESS_KEY;
    this.r2Bucket = environment.R2_BUCKET;
    this.r2Endpoint = environment.R2_ENDPOINT;
    this.r2PublicUrl = environment.R2_PUBLIC_URL.replace(/\/$/, '');
    this.r2Region = environment.R2_REGION;
    this.paymentProvider = environment.PAYMENT_PROVIDER;
    this.stripeSecretKey = environment.STRIPE_SECRET_KEY;
    this.stripeWebhookSecret = environment.STRIPE_WEBHOOK_SECRET;
    this.stripeCurrency = environment.STRIPE_CURRENCY;
    this.stripeCheckoutHoldMinutes = environment.STRIPE_CHECKOUT_HOLD_MINUTES;
    this.bookingCancellationCutoffHours = environment.BOOKING_CANCELLATION_CUTOFF_HOURS;
  }

  get isDevelopment(): boolean {
    return this.environment === APP_ENVIRONMENT.development;
  }

  get isProduction(): boolean {
    return this.environment === APP_ENVIRONMENT.production;
  }
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function rateLimit(limit: number, ttl: number, blockDuration: number) {
  return { limit, ttl, blockDuration };
}
