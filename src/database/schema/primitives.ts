import { sql } from 'drizzle-orm';
import { AnyPgColumn, check, integer, timestamp, uuid } from 'drizzle-orm/pg-core';
import { newUuid } from './identifiers.js';
import { databaseObjectName } from './names.js';

export function uuidPrimaryKey(name = 'id') {
  return uuid(name).primaryKey().$defaultFn(newUuid);
}

export function uuidReference(name: string) {
  return uuid(name).notNull();
}

export function timestampColumns() {
  return {
    createdAt: timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', precision: 3, withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  };
}

export function softDeletionColumn() {
  return timestamp('deleted_at', { mode: 'date', precision: 3, withTimezone: true });
}

export function moneyInCents(name: string) {
  return integer(name).notNull();
}

export function nonNegativeMoneyCheck(table: string, column: AnyPgColumn) {
  return check(databaseObjectName(table, column.name, 'check'), sql`${column} >= 0`);
}
