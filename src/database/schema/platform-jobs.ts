import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { databaseObjectName } from './names.js';
import { uuidPrimaryKey } from './primitives.js';

export const outboxMessages = pgTable(
  'outbox_messages',
  {
    id: uuidPrimaryKey(),
    jobName: text('job_name').notNull(),
    payload: jsonb('payload').$type<unknown>().notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    availableAt: timestamp('available_at', { mode: 'date', precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    dispatchedAt: timestamp('dispatched_at', { mode: 'date', precision: 3, withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    uniqueIndex(
      databaseObjectName('outbox_messages', ['job_name', 'idempotency_key'], 'unique'),
    ).on(table.jobName, table.idempotencyKey),
    index(databaseObjectName('outbox_messages', ['dispatched_at', 'available_at'], 'idx')).on(
      table.dispatchedAt,
      table.availableAt,
    ),
  ],
);

export const jobEffects = pgTable(
  'job_effects',
  {
    id: uuidPrimaryKey(),
    jobName: text('job_name').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    completedAt: timestamp('completed_at', { mode: 'date', precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    uniqueIndex(databaseObjectName('job_effects', ['job_name', 'idempotency_key'], 'unique')).on(
      table.jobName,
      table.idempotencyKey,
    ),
  ],
);
