import type { Pool } from 'pg';
import { APP_ENVIRONMENT } from '../../src/config/config.constants.js';
import {
  DATABASE_SCRIPT_ENVIRONMENT_VARIABLES,
  TEST_DATABASE_WORKER_MARKER,
} from './database-script.constants.js';

interface TableIdentifierRow {
  identifier: string;
}

export function assertDatabaseCanBePurged(
  databaseUrl: string,
  environment = process.env.NODE_ENV,
  override = process.env[DATABASE_SCRIPT_ENVIRONMENT_VARIABLES.allowReset],
  allowedDatabaseNames = process.env[DATABASE_SCRIPT_ENVIRONMENT_VARIABLES.resetAllowedDatabases],
): void {
  if (environment === APP_ENVIRONMENT.production) {
    throw new Error('Database purge is disabled in production');
  }

  const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
  const allowlist =
    allowedDatabaseNames
      ?.split(',')
      .map(name => name.trim())
      .filter(Boolean) ?? [];
  const isBaseDatabase = allowlist.includes(databaseName);
  const isWorkerDatabase = allowlist.some(name =>
    databaseName.startsWith(`${name}${TEST_DATABASE_WORKER_MARKER}`),
  );
  const safeDatabaseName = isBaseDatabase || isWorkerDatabase;

  if (!safeDatabaseName && override !== 'true') {
    throw new Error(
      `Refusing to purge database "${databaseName}". Set ALLOW_DATABASE_RESET=true to override.`,
    );
  }
}

export async function purgeDatabase(pool: Pool, databaseUrl: string): Promise<number> {
  assertDatabaseCanBePurged(databaseUrl);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query<TableIdentifierRow>(`
      SELECT format('%I.%I', schemaname, tablename) AS identifier
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    if (result.rows.length > 0) {
      const identifiers = result.rows.map(row => row.identifier).join(', ');
      await client.query(`TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE`);
    }

    await client.query('COMMIT');
    return result.rows.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
