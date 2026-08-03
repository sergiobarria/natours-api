import type { z } from 'zod';
import type { TransactionContext } from '../../database/database-unit-of-work.js';

export interface DispatchJob<T = unknown> {
  idempotencyKey: string;
  name: string;
  payload: T;
}

export interface JobDispatcher {
  dispatch(job: DispatchJob): Promise<{ id: string }>;
}

export interface DurableJobHandler<T> {
  execute(payload: T, context: TransactionContext): Promise<void>;
}

export interface JobSchedule {
  id: string;
  pattern: string;
  payload: unknown;
}

export interface JobDefinition<T = unknown> {
  handler: DurableJobHandler<T>;
  name: string;
  schedule?: JobSchedule;
  schema: z.ZodType<T>;
}

export interface OutboxMessage<T = unknown> extends DispatchJob<T> {
  availableAt?: Date;
}

export interface TransactionalOutbox {
  enqueue(context: TransactionContext, message: OutboxMessage): Promise<boolean>;
}
