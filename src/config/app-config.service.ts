import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_ENVIRONMENT, ENVIRONMENT_VARIABLES } from './config.constants.js';
import { Environment } from './environment.js';

@Injectable()
export class AppConfigService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService<Environment, true>) {}

  get environment(): Environment['NODE_ENV'] {
    return this.config.get(ENVIRONMENT_VARIABLES.nodeEnv, { infer: true });
  }

  get host(): string {
    return this.config.get(ENVIRONMENT_VARIABLES.host, { infer: true });
  }

  get port(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.port, { infer: true });
  }

  get logLevel(): Environment['LOG_LEVEL'] {
    return this.config.get(ENVIRONMENT_VARIABLES.logLevel, { infer: true });
  }

  get corsOrigins(): string[] {
    return this.config.get(ENVIRONMENT_VARIABLES.corsOrigins, { infer: true });
  }

  get databaseUrl(): string {
    return this.config.get(ENVIRONMENT_VARIABLES.databaseUrl, { infer: true });
  }

  get databasePoolMax(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.databasePoolMax, { infer: true });
  }

  get databasePoolIdleTimeoutMs(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.databasePoolIdleTimeoutMs, { infer: true });
  }

  get databasePoolConnectionTimeoutMs(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.databasePoolConnectionTimeoutMs, {
      infer: true,
    });
  }

  get redisUrl(): string {
    return this.config.get(ENVIRONMENT_VARIABLES.redisUrl, { infer: true });
  }

  get redisKeyPrefix(): string {
    return this.config.get(ENVIRONMENT_VARIABLES.redisKeyPrefix, { infer: true });
  }

  get redisConnectTimeoutMs(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.redisConnectTimeoutMs, { infer: true });
  }

  get redisCommandTimeoutMs(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.redisCommandTimeoutMs, { infer: true });
  }

  get redisMaxRetriesPerRequest(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.redisMaxRetriesPerRequest, { infer: true });
  }

  get jobsQueueName(): string {
    return this.config.get(ENVIRONMENT_VARIABLES.jobsQueueName, { infer: true });
  }

  get jobsAttempts(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.jobsAttempts, { infer: true });
  }

  get jobsBackoffDelayMs(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.jobsBackoffDelayMs, { infer: true });
  }

  get jobsBackoffJitter(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.jobsBackoffJitter, { infer: true });
  }

  get jobsWorkerConcurrency(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.jobsWorkerConcurrency, { infer: true });
  }

  get jobsLockDurationMs(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.jobsLockDurationMs, { infer: true });
  }

  get jobsMaxStalledCount(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.jobsMaxStalledCount, { infer: true });
  }

  get jobsRemoveOnComplete(): { age: number; count: number } {
    return {
      age: this.config.get(ENVIRONMENT_VARIABLES.jobsRemoveOnCompleteAgeSeconds, { infer: true }),
      count: this.config.get(ENVIRONMENT_VARIABLES.jobsRemoveOnCompleteCount, { infer: true }),
    };
  }

  get jobsRemoveOnFail(): { age: number; count: number } {
    return {
      age: this.config.get(ENVIRONMENT_VARIABLES.jobsRemoveOnFailAgeSeconds, { infer: true }),
      count: this.config.get(ENVIRONMENT_VARIABLES.jobsRemoveOnFailCount, { infer: true }),
    };
  }

  get outboxPollIntervalMs(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.outboxPollIntervalMs, { infer: true });
  }

  get outboxBatchSize(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.outboxBatchSize, { infer: true });
  }

  get processShutdownTimeoutMs(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.processShutdownTimeoutMs, { infer: true });
  }

  get trustedProxyCidrs(): string[] {
    return this.config
      .get(ENVIRONMENT_VARIABLES.trustedProxyCidrs, { infer: true })
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
  }

  get rateLimits() {
    return {
      global: {
        limit: this.config.get(ENVIRONMENT_VARIABLES.rateLimitGlobalLimit, { infer: true }),
        ttl: this.config.get(ENVIRONMENT_VARIABLES.rateLimitGlobalTtlMs, { infer: true }),
        blockDuration: this.config.get(ENVIRONMENT_VARIABLES.rateLimitGlobalBlockMs, {
          infer: true,
        }),
      },
      authentication: {
        limit: this.config.get(ENVIRONMENT_VARIABLES.rateLimitAuthLimit, { infer: true }),
        ttl: this.config.get(ENVIRONMENT_VARIABLES.rateLimitAuthTtlMs, { infer: true }),
        blockDuration: this.config.get(ENVIRONMENT_VARIABLES.rateLimitAuthBlockMs, { infer: true }),
      },
      account: {
        limit: this.config.get(ENVIRONMENT_VARIABLES.rateLimitAccountLimit, { infer: true }),
        ttl: this.config.get(ENVIRONMENT_VARIABLES.rateLimitAccountTtlMs, { infer: true }),
        blockDuration: this.config.get(ENVIRONMENT_VARIABLES.rateLimitAccountBlockMs, {
          infer: true,
        }),
      },
    };
  }

  get readinessTimeoutMs(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.readinessTimeoutMs, { infer: true });
  }

  get appUrl(): string {
    return this.config.get(ENVIRONMENT_VARIABLES.appUrl, { infer: true });
  }
  get frontendUrl(): string {
    return this.config.get(ENVIRONMENT_VARIABLES.frontendUrl, { infer: true });
  }
  get betterAuthUrl(): string {
    return this.config.get(ENVIRONMENT_VARIABLES.betterAuthUrl, { infer: true });
  }
  get betterAuthSecret(): string {
    return this.config.get(ENVIRONMENT_VARIABLES.betterAuthSecret, { infer: true });
  }
  get betterAuthTrustedOrigins(): string[] {
    return this.config
      .get(ENVIRONMENT_VARIABLES.betterAuthTrustedOrigins, { infer: true })
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
  }
  get betterAuthSessionExpiresInSeconds(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.betterAuthSessionExpiresInSeconds, {
      infer: true,
    });
  }
  get betterAuthSessionUpdateAgeSeconds(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.betterAuthSessionUpdateAgeSeconds, {
      infer: true,
    });
  }
  get betterAuthVerificationExpiresInSeconds(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.betterAuthVerificationExpiresInSeconds, {
      infer: true,
    });
  }
  get betterAuthPasswordResetExpiresInSeconds(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.betterAuthPasswordResetExpiresInSeconds, {
      infer: true,
    });
  }
  get betterAuthMinPasswordLength(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.betterAuthMinPasswordLength, { infer: true });
  }
  get betterAuthMaxPasswordLength(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.betterAuthMaxPasswordLength, { infer: true });
  }
  get emailProvider(): Environment['EMAIL_PROVIDER'] {
    return this.config.get(ENVIRONMENT_VARIABLES.emailProvider, { infer: true });
  }
  get resendApiKey(): string {
    return this.config.get(ENVIRONMENT_VARIABLES.resendApiKey, { infer: true });
  }
  get mailFromAddress(): string {
    return this.config.get(ENVIRONMENT_VARIABLES.mailFromAddress, { infer: true });
  }
  get mailFromName(): string {
    return this.config.get(ENVIRONMENT_VARIABLES.mailFromName, { infer: true });
  }

  get isDevelopment(): boolean {
    return this.environment === APP_ENVIRONMENT.development;
  }

  get isProduction(): boolean {
    return this.environment === APP_ENVIRONMENT.production;
  }
}
