import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import {
  DATABASE_SCRIPT_ENVIRONMENT_VARIABLES,
  TEST_DATABASE_WORKER_MARKER,
} from '../../scripts/database/database-script.constants.js';
import type { Database } from '../../src/database/database.types.js';
import * as schema from './fixtures/schema.js';

const maintenanceDatabaseName = 'postgres';
const fixtureMigrationsFolder = fileURLToPath(new URL('./fixtures/migrations', import.meta.url));
const productionMigrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export interface TestDatabase {
  database: Database;
  fixtureDatabase: ReturnType<typeof drizzle<typeof schema>>;
  migrateFixtures(): Promise<void>;
  migrateProduction(): Promise<void>;
  pool: Pool;
  release(): Promise<void>;
  url: string;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function withDatabaseName(url: string, databaseName: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const baseUrl = process.env[DATABASE_SCRIPT_ENVIRONMENT_VARIABLES.testDatabaseUrl];

  if (baseUrl === undefined) {
    throw new Error('TEST_DATABASE_URL is required for database integration tests');
  }

  const baseDatabaseName = decodeURIComponent(new URL(baseUrl).pathname.slice(1));
  const workerId = process.env.JEST_WORKER_ID ?? '1';
  const runId = randomUUID().replaceAll('-', '').slice(0, 10);
  const databaseName = `${baseDatabaseName}${TEST_DATABASE_WORKER_MARKER}${workerId}_${process.pid}_${runId}`;
  const maintenanceUrl = withDatabaseName(baseUrl, maintenanceDatabaseName);
  const maintenancePool = new Pool({ connectionString: maintenanceUrl, max: 1 });

  await maintenancePool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);

  const url = withDatabaseName(baseUrl, databaseName);
  const pool = new Pool({ connectionString: url, max: 4 });
  const database = drizzle({
    client: pool,
    schema: await import('../../src/database/schema/index.js'),
  });
  const fixtureDatabase = drizzle({ client: pool, schema });

  return {
    database,
    fixtureDatabase,
    pool,
    url,
    migrateFixtures: async () => {
      await migrate(fixtureDatabase, {
        migrationsFolder: fixtureMigrationsFolder,
        migrationsSchema: 'fixture_migrations',
      });
    },
    migrateProduction: async () => {
      await migrate(database, { migrationsFolder: productionMigrationsFolder });
    },
    release: async () => {
      await pool.end();
      await maintenancePool.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
        [databaseName],
      );
      await maintenancePool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`);
      await maintenancePool.end();
    },
  };
}
