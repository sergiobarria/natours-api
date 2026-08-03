import { Global, Module, Provider } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AppConfigService } from '../../config/app-config.service.js';
import { DatabaseModule } from '../../database/database.module.js';
import { CLOCK, SystemClock } from '../clock/clock.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import { RedisModule } from '../redis/redis.module.js';
import type { RedisClient } from '../redis/redis.types.js';
import { BullJobDispatcher } from './bull-job-dispatcher.js';
import { JOB_DISPATCHER, JOB_QUEUE, OUTBOX } from './job.constants.js';
import { JobQueueLifecycle } from './job-queue.lifecycle.js';
import { JobRegistry } from './job.registry.js';
import { DrizzleTransactionalOutbox } from './transactional-outbox.js';
import {
  HealthSnapshotJob,
  OperationalJobRegistrar,
  OperationsPruneJob,
} from './operational-jobs.js';

const clockProvider: Provider = {
  provide: CLOCK,
  useClass: SystemClock,
};

const queueProvider: Provider<Queue> = {
  provide: JOB_QUEUE,
  inject: [AppConfigService, REDIS_CLIENT],
  useFactory(config: AppConfigService, redis: RedisClient): Queue {
    return new Queue(config.jobsQueueName, {
      connection: redis,
      prefix: config.redisKeyPrefix,
    });
  },
};

@Global()
@Module({
  imports: [DatabaseModule, RedisModule],
  providers: [
    clockProvider,
    queueProvider,
    JobRegistry,
    BullJobDispatcher,
    DrizzleTransactionalOutbox,
    JobQueueLifecycle,
    HealthSnapshotJob,
    OperationsPruneJob,
    OperationalJobRegistrar,
    { provide: JOB_DISPATCHER, useExisting: BullJobDispatcher },
    { provide: OUTBOX, useExisting: DrizzleTransactionalOutbox },
  ],
  exports: [CLOCK, JOB_DISPATCHER, JOB_QUEUE, OUTBOX, JobRegistry],
})
export class PlatformJobsModule {}
