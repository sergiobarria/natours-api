import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { AppConfigService } from '../../config/app-config.service.js';
import {
  BOOKING_CHECKOUT_RECOVERY_JOB,
  BOOKING_EXPIRE_JOB,
  BOOKING_REFUND_RECONCILIATION_JOB,
  JOB_QUEUE,
} from './job.constants.js';

@Injectable()
export class JobSchedulerLifecycle implements OnModuleInit {
  constructor(
    @Inject(JOB_QUEUE) private readonly queue: Queue,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}
  async onModuleInit() {
    const options = {
      attempts: this.config.jobsAttempts,
      backoff: { type: 'exponential' as const, delay: this.config.jobsBackoffDelayMs },
      removeOnComplete: this.config.jobsRemoveOnComplete,
      removeOnFail: this.config.jobsRemoveOnFail,
    };
    await this.queue.upsertJobScheduler(
      BOOKING_EXPIRE_JOB,
      { every: 60_000 },
      { name: BOOKING_EXPIRE_JOB, data: { payload: {} }, opts: options },
    );
    await this.queue.upsertJobScheduler(
      BOOKING_CHECKOUT_RECOVERY_JOB,
      { every: 60_000 },
      { name: BOOKING_CHECKOUT_RECOVERY_JOB, data: { payload: {} }, opts: options },
    );
    await this.queue.upsertJobScheduler(
      BOOKING_REFUND_RECONCILIATION_JOB,
      { every: 600_000 },
      { name: BOOKING_REFUND_RECONCILIATION_JOB, data: { payload: {} }, opts: options },
    );
  }
}
