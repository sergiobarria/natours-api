import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { databaseObjectName } from './names.js';
import { uuidPrimaryKey } from './primitives.js';

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuidPrimaryKey(),
    eventKey: text('event_key').notNull(),
    actorId: uuid('actor_id'),
    actorType: text('actor_type').notNull(),
    systemActorName: text('system_actor_name'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    requestId: text('request_id'),
    before: jsonb('before').$type<Record<string, unknown> | null>(),
    after: jsonb('after').$type<Record<string, unknown> | null>(),
    occurredAt: timestamp('occurred_at', { mode: 'date', precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    uniqueIndex(databaseObjectName('audit_events', 'event_key', 'unique')).on(table.eventKey),
    index(databaseObjectName('audit_events', ['target_type', 'target_id'], 'idx')).on(
      table.targetType,
      table.targetId,
    ),
    check(
      databaseObjectName('audit_events', 'actor_shape', 'check'),
      sql`(${table.actorType} = 'user' AND ${table.actorId} IS NOT NULL AND ${table.systemActorName} IS NULL) OR (${table.actorType} = 'system' AND ${table.actorId} IS NULL AND ${table.systemActorName} IS NOT NULL)`,
    ),
  ],
);

export const healthHistory = pgTable(
  'health_history',
  {
    id: uuidPrimaryKey(),
    component: text('component').notNull(),
    status: text('status').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    observedAt: timestamp('observed_at', { mode: 'date', precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [index(databaseObjectName('health_history', 'observed_at', 'idx')).on(table.observedAt)],
);
