import { foreignKey, index, integer, pgTable, text, unique } from 'drizzle-orm/pg-core';
import {
  databaseObjectName,
  moneyInCents,
  nonNegativeMoneyCheck,
  softDeletionColumn,
  timestampColumns,
  uuidPrimaryKey,
  uuidReference,
} from '../../../src/database/schema/index.js';

export const persistenceRecords = pgTable(
  'persistence_records',
  {
    id: uuidPrimaryKey(),
    externalKey: text('external_key').notNull(),
    label: text('label').notNull().default('fixture'),
    amountInCents: moneyInCents('amount_in_cents'),
    sequence: integer('sequence').notNull(),
    ...timestampColumns(),
    deletedAt: softDeletionColumn(),
  },
  table => [
    nonNegativeMoneyCheck('persistence_records', table.amountInCents),
    unique(databaseObjectName('persistence_records', 'external_key', 'unique')).on(
      table.externalKey,
    ),
    index(databaseObjectName('persistence_records', 'created_at', 'idx')).on(table.createdAt),
  ],
);

export const persistenceChildren = pgTable(
  'persistence_children',
  {
    id: uuidPrimaryKey(),
    recordId: uuidReference('record_id'),
  },
  table => [
    foreignKey({
      columns: [table.recordId],
      foreignColumns: [persistenceRecords.id],
      name: databaseObjectName('persistence_children', 'record_id', 'fk'),
    }),
  ],
);
