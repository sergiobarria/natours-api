import { Global, Module, Provider } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AppConfigService } from '../../config/app-config.service.js';
import { DatabaseModule } from '../../database/database.module.js';
import { CLOCK, SystemClock } from '../clock/clock.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import { RedisModule } from '../redis/redis.module.js';
import type { RedisClient } from '../redis/redis.types.js';
import { BullJobDispatcher } from './bull-job-dispatcher.js';
import { JOB_QUEUE } from './job.constants.js';
import { JobQueueLifecycle } from './job-queue.lifecycle.js';
import { TransactionalOutbox } from './transactional-outbox.js';

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
    BullJobDispatcher,
    TransactionalOutbox,
    JobQueueLifecycle,
  ],
  exports: [CLOCK, JOB_QUEUE, BullJobDispatcher, TransactionalOutbox],
})
export class PlatformJobsModule {}
