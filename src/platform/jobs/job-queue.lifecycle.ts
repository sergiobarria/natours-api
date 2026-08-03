import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { JOB_QUEUE } from './job.constants.js';

@Injectable()
export class JobQueueLifecycle implements OnApplicationShutdown {
  constructor(@Inject(JOB_QUEUE) private readonly queue: Queue) {}

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
