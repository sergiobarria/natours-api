import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import type { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service.js';
import { DATABASE_POOL } from '../database/database.constants.js';
import { REDIS_CLIENT } from '../platform/redis/redis.constants.js';
import type { RedisClient } from '../platform/redis/redis.types.js';

@Injectable()
export class ReadinessService {
  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    @Inject(HealthIndicatorService) private readonly indicators: HealthIndicatorService,
  ) {}

  postgres(): Promise<HealthIndicatorResult> {
    return this.probe('postgres', async () => {
      await this.pool.query('select 1');
    });
  }

  redisProbe(): Promise<HealthIndicatorResult> {
    return this.probe('redis', async () => {
      await this.redis.ping();
    });
  }

  heartbeat(role: 'worker' | 'scheduler'): Promise<HealthIndicatorResult> {
    return this.probe(role, async () => {
      let cursor = '0';
      do {
        const result = await this.redis.scan(
          cursor,
          'MATCH',
          `${this.config.redisKeyPrefix}:heartbeat:${role}:*`,
          'COUNT',
          10,
        );
        cursor = result[0];
        if (result[1].length > 0) return;
      } while (cursor !== '0');
      throw new Error(`${role} heartbeat is stale`);
    });
  }

  private async probe(name: string, work: () => Promise<void>): Promise<HealthIndicatorResult> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${name} probe timed out`)),
          this.config.readinessTimeoutMs,
        );
      });
      await Promise.race([work(), timeout]);
      return this.indicators.check(name).up();
    } catch {
      return this.indicators.check(name).down('unavailable');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
