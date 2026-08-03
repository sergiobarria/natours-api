import { Inject, Injectable } from '@nestjs/common';
import { getTransactionDatabase } from '../../database/database-unit-of-work.js';
import { outboxMessages } from '../../database/schema/platform-jobs.js';
import { CLOCK, type Clock } from '../clock/clock.js';
import { JobRegistry } from './job.registry.js';
import type { OutboxMessage, TransactionalOutbox } from './job.types.js';

@Injectable()
export class DrizzleTransactionalOutbox implements TransactionalOutbox {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly registry: JobRegistry,
  ) {}

  async enqueue(
    context: Parameters<TransactionalOutbox['enqueue']>[0],
    message: OutboxMessage,
  ): Promise<boolean> {
    const definition = this.registry.get(message.name);
    const payload = definition.schema.parse(message.payload);
    const inserted = await getTransactionDatabase(context)
      .insert(outboxMessages)
      .values({
        availableAt: message.availableAt ?? this.clock.now(),
        idempotencyKey: message.idempotencyKey,
        jobName: message.name,
        payload,
      })
      .onConflictDoNothing()
      .returning({ id: outboxMessages.id });
    return inserted.length === 1;
  }
}
