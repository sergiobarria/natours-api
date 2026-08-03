import { Inject, Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../config/app-config.service.js';
import { REDIS_CLIENT } from '../platform/redis/redis.constants.js';
import type { RedisClient } from '../platform/redis/redis.types.js';

abstract class ProcessHeartbeat implements OnModuleInit, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private readonly instanceId = randomUUID();

  constructor(
    private readonly role: 'worker' | 'scheduler',
    private readonly intervalMs: number,
    protected readonly config: AppConfigService,
    protected readonly redis: RedisClient,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.intervalMs);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.redis.del(this.key());
  }

  private async refresh(): Promise<void> {
    await this.redis.set(
      this.key(),
      String(Date.now()),
      'EX',
      this.config.processHeartbeatTtlSeconds,
    );
  }

  private key(): string {
    return `${this.config.redisKeyPrefix}:heartbeat:${this.role}:${this.instanceId}`;
  }
}

@Injectable()
export class WorkerHeartbeat extends ProcessHeartbeat {
  constructor(
    @Inject(AppConfigService) config: AppConfigService,
    @Inject(REDIS_CLIENT) redis: RedisClient,
  ) {
    super('worker', config.workerHeartbeatIntervalMs, config, redis);
  }
}

@Injectable()
export class SchedulerHeartbeat extends ProcessHeartbeat {
  constructor(
    @Inject(AppConfigService) config: AppConfigService,
    @Inject(REDIS_CLIENT) redis: RedisClient,
  ) {
    super('scheduler', config.schedulerHeartbeatIntervalMs, config, redis);
  }
}
