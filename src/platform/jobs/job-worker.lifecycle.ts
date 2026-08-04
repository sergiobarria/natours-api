import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { UnrecoverableError, Worker, type Job } from 'bullmq';
import { AppConfigService } from '../../config/app-config.service.js';
import { DatabaseUnitOfWork } from '../../database/database-unit-of-work.js';
import { jobEffects } from '../../database/schema/platform-jobs.js';
import { sanitizeOperationalError } from '../../security/sensitive-data.js';
import { AuthEmailJob, parseAuthEmailPayload } from '../../identity/auth-email.job.js';
import { AUTH_EMAIL_JOB } from '../../identity/identity.constants.js';
import { BookingsService } from '../../bookings/bookings.service.js';
import {
  BOOKING_CHECKOUT_RECOVERY_JOB,
  BOOKING_EXPIRE_JOB,
  BOOKING_REFUND_RECONCILIATION_JOB,
} from './job.constants.js';
import { REDIS_BLOCKING_CLIENT_FACTORY } from '../redis/redis.constants.js';
import type { RedisBlockingClientFactory } from '../redis/redis.types.js';
import type { RedisClient } from '../redis/redis.types.js';

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
    private readonly unitOfWork: DatabaseUnitOfWork,
    @Inject(AuthEmailJob) private readonly authEmail: Pick<AuthEmailJob, 'execute'>,
    @Inject(REDIS_BLOCKING_CLIENT_FACTORY)
    private readonly createBlockingClient: RedisBlockingClientFactory,
    @Optional() private readonly bookings?: BookingsService,
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
    if (job.name === BOOKING_EXPIRE_JOB) {
      await this.requireBookings().expireDue();
      return;
    }
    if (job.name === BOOKING_CHECKOUT_RECOVERY_JOB) {
      await this.requireBookings().recoverCheckouts();
      return;
    }
    if (job.name === BOOKING_REFUND_RECONCILIATION_JOB) {
      await this.requireBookings().reconcileRefunds();
      return;
    }
    if (job.name !== AUTH_EMAIL_JOB) {
      throw new UnrecoverableError(`Unknown job type: ${job.name}`);
    }
    const payload = parseAuthEmailPayload(job.data.payload);
    const idempotencyKey = job.data.idempotencyKey ?? String(job.id);

    await this.unitOfWork.transaction(async transaction => {
      const inserted = await transaction
        .insert(jobEffects)
        .values({ idempotencyKey, jobName: job.name })
        .onConflictDoNothing()
        .returning({ id: jobEffects.id });

      if (inserted.length === 0) {
        this.logger.debug({ idempotencyKey, jobName: job.name }, 'Duplicate job effect skipped');
        return;
      }

      await this.authEmail.execute(payload);
    });
  }

  private requireBookings(): BookingsService {
    if (!this.bookings) throw new UnrecoverableError('Bookings worker is unavailable.');
    return this.bookings;
  }
}
