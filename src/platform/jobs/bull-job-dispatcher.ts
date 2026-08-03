import { Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { AppConfigService } from '../../config/app-config.service.js';
import { JOB_QUEUE } from './job.constants.js';
import { stableJobId } from './job-id.js';
import type { DispatchJob } from './job.types.js';

@Injectable()
export class BullJobDispatcher {
  constructor(
    @Inject(JOB_QUEUE) private readonly queue: Queue,
    private readonly config: AppConfigService,
  ) {}

  async dispatch(job: DispatchJob): Promise<{ id: string }> {
    const id = stableJobId(job.name, job.idempotencyKey);
    const queued = await this.queue.add(
      job.name,
      { idempotencyKey: job.idempotencyKey, payload: job.payload },
      {
        attempts: this.config.jobsAttempts,
        backoff: {
          delay: this.config.jobsBackoffDelayMs,
          jitter: this.config.jobsBackoffJitter,
          type: 'exponential',
        },
        jobId: id,
        removeOnComplete: this.config.jobsRemoveOnComplete,
        removeOnFail: this.config.jobsRemoveOnFail,
      },
    );
    return { id: String(queued.id) };
  }
}
