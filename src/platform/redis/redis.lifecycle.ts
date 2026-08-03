import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { REDIS_CLIENT } from './redis.constants.js';
import { sanitizeOperationalError } from '../../security/sensitive-data.js';
import type { RedisClient } from './redis.types.js';

@Injectable()
export class RedisLifecycle implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisLifecycle.name);
  private readonly handleError = (error: Error): void => {
    this.logger.error(
      { err: sanitizeOperationalError(error) },
      'Unexpected Redis connection error',
    );
  };

  constructor(@Inject(REDIS_CLIENT) private readonly client: RedisClient) {}

  async onModuleInit(): Promise<void> {
    this.client.on('error', this.handleError);
    if (this.client.status === 'wait' || this.client.status === 'end') {
      await this.client.connect();
      return;
    }
    if (this.client.status !== 'ready') {
      await new Promise<void>((resolve, reject) => {
        const onReady = (): void => {
          cleanup();
          resolve();
        };
        const onError = (error: Error): void => {
          cleanup();
          reject(error);
        };
        const cleanup = (): void => {
          this.client.off('ready', onReady);
          this.client.off('error', onError);
        };
        this.client.once('ready', onReady);
        this.client.once('error', onError);
      });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.client.off('error', this.handleError);
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}
