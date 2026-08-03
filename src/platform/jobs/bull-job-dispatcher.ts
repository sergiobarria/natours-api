import { Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { AppConfigService } from '../../config/app-config.service.js';
import { JOB_QUEUE } from './job.constants.js';
import { stableJobId } from './job-id.js';
import { JobRegistry } from './job.registry.js';
import type { DispatchJob, JobDispatcher } from './job.types.js';

@Injectable()
export class BullJobDispatcher implements JobDispatcher {
  constructor(
    @Inject(JOB_QUEUE) private readonly queue: Queue,
    private readonly config: AppConfigService,
    private readonly registry: JobRegistry,
  ) {}

  async dispatch(job: DispatchJob): Promise<{ id: string }> {
    const definition = this.registry.get(job.name);
    const payload = definition.schema.parse(job.payload);
    const id = stableJobId(job.name, job.idempotencyKey);
    const queued = await this.queue.add(
      job.name,
      { idempotencyKey: job.idempotencyKey, payload },
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
