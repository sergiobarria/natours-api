import { getTableConfig, pgTable, text } from 'drizzle-orm/pg-core';
import { databaseObjectName } from './names.js';
import {
  moneyInCents,
  nonNegativeMoneyCheck,
  softDeletionColumn,
  timestampColumns,
  uuidPrimaryKey,
} from './primitives.js';

describe('database schema primitives', () => {
  it('creates UUID, UTC timestamp, money, and soft-deletion columns', () => {
    const table = pgTable(
      'schema_primitive_records',
      {
        id: uuidPrimaryKey(),
        amountInCents: moneyInCents('amount_in_cents'),
        ...timestampColumns(),
        deletedAt: softDeletionColumn(),
      },
      definition => [nonNegativeMoneyCheck('schema_primitive_records', definition.amountInCents)],
    );
    const config = getTableConfig(table);

    expect(table.id.dataType).toBe('string');
    expect(table.id.notNull).toBe(true);
    expect(table.id.primary).toBe(true);
    expect(table.createdAt.columnType).toBe('PgTimestamp');
    expect(table.createdAt.getSQLType()).toBe('timestamp (3) with time zone');
    expect(table.deletedAt.notNull).toBe(false);
    expect(table.amountInCents.columnType).toBe('PgInteger');
    expect(config.checks).toHaveLength(1);
  });

  it('creates deterministic PostgreSQL-safe object names', () => {
    expect(databaseObjectName('tour_start_dates', ['tour_id', 'start_at'], 'unique')).toBe(
      'tour_start_dates_tour_id_start_at_unique',
    );

    const longName = databaseObjectName(
      'an_extremely_long_table_name_for_a_domain_record',
      'an_extremely_long_foreign_key_column_name',
      'fk',
    );
    expect(longName).toHaveLength(63);
    expect(longName).toMatch(/_[a-f0-9]{8}$/);
  });

  it('allows regular columns to coexist with the shared helpers', () => {
    const table = pgTable('example', { id: uuidPrimaryKey(), label: text('label').notNull() });
    expect(table.label.notNull).toBe(true);
  });
});
