import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '../../database/database.types.js';
import { outboxMessages } from '../../database/schema/platform-jobs.js';
import { CLOCK, type Clock } from '../clock/clock.js';
import type { OutboxMessage } from './job.types.js';

@Injectable()
export class TransactionalOutbox {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  async enqueue(transaction: DatabaseTransaction, message: OutboxMessage): Promise<boolean> {
    const inserted = await transaction
      .insert(outboxMessages)
      .values({
        availableAt: message.availableAt ?? this.clock.now(),
        idempotencyKey: message.idempotencyKey,
        jobName: message.name,
        payload: message.payload,
      })
      .onConflictDoNothing()
      .returning({ id: outboxMessages.id });
    return inserted.length === 1;
  }
}
