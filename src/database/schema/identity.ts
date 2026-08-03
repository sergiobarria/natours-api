import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { databaseObjectName } from './names.js';
import { timestampColumns, uuidPrimaryKey } from './primitives.js';

export const APPLICATION_ROLES = ['user', 'guide', 'lead-guide', 'admin'] as const;
export type ApplicationRole = (typeof APPLICATION_ROLES)[number];

export const users = pgTable(
  'users',
  {
    id: uuidPrimaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    role: text('role').$type<ApplicationRole>().notNull().default('user'),
    ...timestampColumns(),
  },
  table => [
    uniqueIndex(databaseObjectName('users', 'email', 'unique')).on(table.email),
    check(
      databaseObjectName('users', 'role', 'check'),
      sql`${table.role} IN ('user', 'guide', 'lead-guide', 'admin')`,
    ),
  ],
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuidPrimaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      mode: 'date',
      precision: 3,
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      mode: 'date',
      precision: 3,
      withTimezone: true,
    }),
    scope: text('scope'),
    password: text('password'),
    ...timestampColumns(),
  },
  table => [
    uniqueIndex(databaseObjectName('accounts', ['provider_id', 'account_id'], 'unique')).on(
      table.providerId,
      table.accountId,
    ),
    index(databaseObjectName('accounts', 'user_id', 'idx')).on(table.userId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuidPrimaryKey(),
    expiresAt: timestamp('expires_at', {
      mode: 'date',
      precision: 3,
      withTimezone: true,
    }).notNull(),
    token: text('token').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestampColumns(),
  },
  table => [
    uniqueIndex(databaseObjectName('sessions', 'token', 'unique')).on(table.token),
    index(databaseObjectName('sessions', 'user_id', 'idx')).on(table.userId),
    index(databaseObjectName('sessions', 'expires_at', 'idx')).on(table.expiresAt),
  ],
);

export const verifications = pgTable(
  'verifications',
  {
    id: uuidPrimaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', {
      mode: 'date',
      precision: 3,
      withTimezone: true,
    }).notNull(),
    ...timestampColumns(),
  },
  table => [
    index(databaseObjectName('verifications', 'identifier', 'idx')).on(table.identifier),
    index(databaseObjectName('verifications', 'expires_at', 'idx')).on(table.expiresAt),
  ],
);
