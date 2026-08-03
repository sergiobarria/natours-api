import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { AppConfigService } from '../../config/app-config.service.js';
import {
  getTransactionDatabase,
  type TransactionContext,
} from '../../database/database-unit-of-work.js';
import { healthHistory } from '../../database/schema/operations.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import type { RedisClient } from '../redis/redis.types.js';
import { PLATFORM_JOB } from './job.constants.js';
import { JobRegistry } from './job.registry.js';
import type { DurableJobHandler } from './job.types.js';

const emptyPayload = z.object({}).strict();

@Injectable()
export class HealthSnapshotJob implements DurableJobHandler<Record<string, never>> {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  async execute(_: Record<string, never>, context: TransactionContext): Promise<void> {
    const database = getTransactionDatabase(context);
    const postgresStarted = performance.now();
    await database.execute(sql`select 1`);
    const postgresLatency = Math.max(0, Math.round(performance.now() - postgresStarted));
    const redisStarted = performance.now();
    let redisStatus = 'up';
    try {
      await this.redis.ping();
    } catch {
      redisStatus = 'down';
    }
    const redisLatency = Math.max(0, Math.round(performance.now() - redisStarted));
    await database.insert(healthHistory).values([
      { component: 'postgres', latencyMs: postgresLatency, status: 'up' },
      { component: 'redis', latencyMs: redisLatency, status: redisStatus },
    ]);
  }
}

@Injectable()
export class OperationsPruneJob implements DurableJobHandler<Record<string, never>> {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  async execute(_: Record<string, never>, context: TransactionContext): Promise<void> {
    await getTransactionDatabase(context).execute(
      sql`delete from ${healthHistory} where ${healthHistory.observedAt} < now() - (${this.config.healthHistoryRetentionDays} * interval '1 day')`,
    );
  }
}

@Injectable()
export class OperationalJobRegistrar implements OnModuleInit {
  constructor(
    @Inject(JobRegistry) private readonly registry: JobRegistry,
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(HealthSnapshotJob) private readonly snapshot: HealthSnapshotJob,
    @Inject(OperationsPruneJob) private readonly prune: OperationsPruneJob,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      handler: this.snapshot,
      name: PLATFORM_JOB.healthSnapshot,
      schema: emptyPayload,
      schedule: {
        id: PLATFORM_JOB.healthSnapshot,
        pattern: this.config.healthSnapshotSchedule,
        payload: {},
      },
    });
    this.registry.register({
      handler: this.prune,
      name: PLATFORM_JOB.operationsPrune,
      schema: emptyPayload,
      schedule: {
        id: PLATFORM_JOB.operationsPrune,
        pattern: this.config.operationsPruneSchedule,
        payload: {},
      },
    });
  }
}
