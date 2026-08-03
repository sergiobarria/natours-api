import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfigService } from '../config/app-config.service.js';
import { REDIS_CLIENT } from '../platform/redis/redis.constants.js';
import { RedisModule } from '../platform/redis/redis.module.js';
import type { RedisClient } from '../platform/redis/redis.types.js';
import { RATE_LIMIT_POLICY, RATE_LIMIT_POLICY_METADATA } from './rate-limit.constants.js';
import { ApplicationThrottlerGuard } from './application-throttler.guard.js';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [AppConfigService, REDIS_CLIENT],
      useFactory: (config: AppConfigService, redis: RedisClient) => ({
        storage: new RedisThrottlerStorage(redis, config),
        throttlers: Object.entries(config.rateLimits).map(([name, policy]) => ({
          ...policy,
          name,
          skipIf: context => {
            if (name === RATE_LIMIT_POLICY.global) return false;
            const handlerPolicy = Reflect.getMetadata(
              RATE_LIMIT_POLICY_METADATA,
              context.getHandler(),
            ) as unknown;
            const selected =
              handlerPolicy ??
              (Reflect.getMetadata(RATE_LIMIT_POLICY_METADATA, context.getClass()) as unknown);
            return selected !== name;
          },
        })),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ApplicationThrottlerGuard }],
})
export class RateLimitModule {}
