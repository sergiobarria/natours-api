import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { UnrecoverableError, Worker, type Job } from 'bullmq';
import { AppConfigService } from '../../config/app-config.service.js';
import {
  DatabaseUnitOfWork,
  getTransactionDatabase,
} from '../../database/database-unit-of-work.js';
import { jobEffects } from '../../database/schema/platform-jobs.js';
import { sanitizeOperationalError } from '../../security/sensitive-data.js';
import { REDIS_BLOCKING_CLIENT_FACTORY } from '../redis/redis.constants.js';
import type { RedisBlockingClientFactory } from '../redis/redis.types.js';
import type { RedisClient } from '../redis/redis.types.js';
import { JobRegistry } from './job.registry.js';

interface QueuedJobData {
  idempotencyKey?: string;
  payload: unknown;
}

@Injectable()
export class JobWorkerLifecycle implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(JobWorkerLifecycle.name);
  private worker?: Worker<QueuedJobData>;
  private blockingConnection?: RedisClient;

  constructor(
    private readonly config: AppConfigService,
    private readonly registry: JobRegistry,
    private readonly unitOfWork: DatabaseUnitOfWork,
    @Inject(REDIS_BLOCKING_CLIENT_FACTORY)
    private readonly createBlockingClient: RedisBlockingClientFactory,
  ) {}

  onModuleInit(): void {
    this.blockingConnection = this.createBlockingClient();
    this.worker = new Worker<QueuedJobData>(this.config.jobsQueueName, job => this.process(job), {
      connection: this.blockingConnection,
      concurrency: this.config.jobsWorkerConcurrency,
      lockDuration: this.config.jobsLockDurationMs,
      maxStalledCount: this.config.jobsMaxStalledCount,
      prefix: this.config.redisKeyPrefix,
    });
    this.worker.on('error', error =>
      this.logger.error({ err: sanitizeOperationalError(error) }, 'Queue worker error'),
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        { err: sanitizeOperationalError(error), jobId: job?.id, jobName: job?.name },
        'Durable job failed',
      );
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    if (this.blockingConnection && this.blockingConnection.status !== 'end') {
      await this.blockingConnection.quit();
    }
  }

  private async process(job: Job<QueuedJobData>): Promise<void> {
    let definition;
    try {
      definition = this.registry.get(job.name);
    } catch (error) {
      throw new UnrecoverableError(error instanceof Error ? error.message : String(error));
    }

    const payload = definition.schema.parse(job.data.payload);
    const idempotencyKey = job.data.idempotencyKey ?? String(job.id);

    await this.unitOfWork.transaction(async context => {
      const inserted = await getTransactionDatabase(context)
        .insert(jobEffects)
        .values({ idempotencyKey, jobName: job.name })
        .onConflictDoNothing()
        .returning({ id: jobEffects.id });

      if (inserted.length === 0) {
        this.logger.debug({ idempotencyKey, jobName: job.name }, 'Duplicate job effect skipped');
        return;
      }

      await definition.handler.execute(payload, context);
    });
  }
}
