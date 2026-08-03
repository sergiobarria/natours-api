import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { and, asc, isNull, lte, sql } from 'drizzle-orm';
import { AppConfigService } from '../../config/app-config.service.js';
import { DatabaseUnitOfWork } from '../../database/database-unit-of-work.js';
import { outboxMessages } from '../../database/schema/platform-jobs.js';
import {
  sanitizeOperationalError,
  sanitizeOperationalText,
} from '../../security/sensitive-data.js';
import { CLOCK, type Clock } from '../clock/clock.js';
import { BullJobDispatcher } from './bull-job-dispatcher.js';

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return sanitizeOperationalText(message).slice(0, 1_000);
}

@Injectable()
export class OutboxRelay implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;

  constructor(
    private readonly config: AppConfigService,
    private readonly unitOfWork: DatabaseUnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BullJobDispatcher)
    private readonly dispatcher: Pick<BullJobDispatcher, 'dispatch'>,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => this.startRun(), this.config.outboxPollIntervalMs);
    this.startRun();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.running) {
      await Promise.race([
        this.running,
        new Promise<void>(resolve => setTimeout(resolve, this.config.processShutdownTimeoutMs)),
      ]);
    }
  }

  async runOnce(): Promise<number> {
    let dispatched = 0;
    await this.unitOfWork.transaction(async transaction => {
      const messages = await transaction
        .select()
        .from(outboxMessages)
        .where(
          and(
            isNull(outboxMessages.dispatchedAt),
            lte(outboxMessages.availableAt, this.clock.now()),
          ),
        )
        .orderBy(asc(outboxMessages.availableAt), asc(outboxMessages.createdAt))
        .limit(this.config.outboxBatchSize)
        .for('update', { skipLocked: true });

      for (const message of messages) {
        try {
          await this.dispatcher.dispatch({
            idempotencyKey: message.idempotencyKey,
            name: message.jobName,
            payload: message.payload,
          });
          await transaction
            .update(outboxMessages)
            .set({ dispatchedAt: this.clock.now(), lastError: null })
            .where(sql`${outboxMessages.id} = ${message.id}`);
          dispatched += 1;
        } catch (error) {
          await transaction
            .update(outboxMessages)
            .set({
              attemptCount: sql`${outboxMessages.attemptCount} + 1`,
              lastError: safeErrorMessage(error),
            })
            .where(sql`${outboxMessages.id} = ${message.id}`);
          this.logger.error(
            { err: sanitizeOperationalError(error), outboxMessageId: message.id },
            'Outbox dispatch failed',
          );
        }
      }
    });
    return dispatched;
  }

  private startRun(): void {
    if (this.running) {
      return;
    }
    this.running = this.runOnce()
      .then(() => undefined)
      .catch(error =>
        this.logger.error(
          { err: sanitizeOperationalError(error) },
          'Outbox relay iteration failed',
        ),
      )
      .finally(() => {
        this.running = undefined;
      });
  }
}
