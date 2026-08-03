import { Global, Module, Provider } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfigService } from '../../config/app-config.service.js';
import { REDIS_BLOCKING_CLIENT_FACTORY, REDIS_CLIENT } from './redis.constants.js';
import { RedisLifecycle } from './redis.lifecycle.js';
import type { RedisBlockingClientFactory, RedisClient } from './redis.types.js';

const redisClientProvider: Provider<RedisClient> = {
  provide: REDIS_CLIENT,
  inject: [AppConfigService],
  useFactory(config: AppConfigService): RedisClient {
    return new Redis(config.redisUrl, {
      commandTimeout: config.redisCommandTimeoutMs,
      connectTimeout: config.redisConnectTimeoutMs,
      lazyConnect: true,
      maxRetriesPerRequest: config.redisMaxRetriesPerRequest,
    });
  },
};

const blockingClientFactoryProvider: Provider<RedisBlockingClientFactory> = {
  provide: REDIS_BLOCKING_CLIENT_FACTORY,
  inject: [AppConfigService],
  useFactory(config: AppConfigService): RedisBlockingClientFactory {
    return () =>
      new Redis(config.redisUrl, {
        connectTimeout: config.redisConnectTimeoutMs,
        maxRetriesPerRequest: null,
      });
  },
};

@Global()
@Module({
  providers: [redisClientProvider, blockingClientFactoryProvider, RedisLifecycle],
  exports: [REDIS_CLIENT, REDIS_BLOCKING_CLIENT_FACTORY],
})
export class RedisModule {}
