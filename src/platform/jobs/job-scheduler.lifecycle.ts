import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { AppConfigService } from '../../config/app-config.service.js';
import { JOB_QUEUE } from './job.constants.js';
import { JobRegistry } from './job.registry.js';

@Injectable()
export class JobSchedulerLifecycle implements OnModuleInit {
  constructor(
    @Inject(JOB_QUEUE) private readonly queue: Queue,
    private readonly registry: JobRegistry,
    private readonly config: AppConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const definition of this.registry.list()) {
      if (!definition.schedule) {
        continue;
      }
      const payload = definition.schema.parse(definition.schedule.payload);
      await this.queue.upsertJobScheduler(
        definition.schedule.id,
        { pattern: definition.schedule.pattern },
        {
          data: { payload },
          name: definition.name,
          opts: {
            attempts: this.config.jobsAttempts,
            backoff: {
              delay: this.config.jobsBackoffDelayMs,
              jitter: this.config.jobsBackoffJitter,
              type: 'exponential',
            },
            removeOnComplete: this.config.jobsRemoveOnComplete,
            removeOnFail: this.config.jobsRemoveOnFail,
          },
        },
      );
    }
  }
}
