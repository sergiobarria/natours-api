import { Inject, Injectable } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { sanitizeOperationalText } from '../../security/sensitive-data.js';
import { JOB_QUEUE } from './job.constants.js';

export interface InspectedJob {
  attemptsMade: number;
  failedReason?: string;
  finishedOn?: number;
  id: string;
  name: string;
  processedOn?: number;
  stacktrace: string[];
  state: string;
  timestamp: number;
}

@Injectable()
export class JobOperationsService {
  constructor(@Inject(JOB_QUEUE) private readonly queue: Queue) {}

  async listFailed(limit: number): Promise<InspectedJob[]> {
    const jobs = await this.queue.getFailed(0, Math.max(0, limit - 1));
    return Promise.all(jobs.map(job => this.present(job)));
  }

  async inspect(id: string): Promise<InspectedJob | undefined> {
    const job = await this.queue.getJob(id);
    return job ? this.present(job) : undefined;
  }

  async replay(id: string, state: 'completed' | 'failed'): Promise<void> {
    const job = await this.queue.getJob(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }
    await job.retry(state, { resetAttemptsMade: true });
  }

  private async present(job: Job): Promise<InspectedJob> {
    return {
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ? sanitizeOperationalText(job.failedReason) : undefined,
      finishedOn: job.finishedOn,
      id: String(job.id),
      name: job.name,
      processedOn: job.processedOn,
      stacktrace: (job.stacktrace ?? []).map(line => sanitizeOperationalText(line)),
      state: await job.getState(),
      timestamp: job.timestamp,
    };
  }
}
