import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './identity.js';
import { databaseObjectName } from './names.js';
import { timestampColumns, uuidPrimaryKey } from './primitives.js';
import { tours } from './tours.js';

export const reviews = pgTable(
  'reviews',
  {
    id: uuidPrimaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    tourId: uuid('tour_id')
      .notNull()
      .references(() => tours.id, { onDelete: 'restrict' }),
    rating: integer('rating').notNull(),
    text: text('text').notNull(),
    ...timestampColumns(),
  },
  table => [
    uniqueIndex(databaseObjectName('reviews', ['user_id', 'tour_id'], 'unique')).on(
      table.userId,
      table.tourId,
    ),
    index(databaseObjectName('reviews', ['tour_id', 'created_at', 'id'], 'idx')).on(
      table.tourId,
      sql`${table.createdAt} DESC`,
      sql`${table.id} DESC`,
    ),
    check(databaseObjectName('reviews', 'rating', 'check'), sql`${table.rating} BETWEEN 1 AND 5`),
    check(
      databaseObjectName('reviews', 'text', 'check'),
      sql`char_length(btrim(${table.text})) BETWEEN 1 AND 2000`,
    ),
  ],
);
