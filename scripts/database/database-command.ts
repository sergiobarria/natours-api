import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ENVIRONMENT_VARIABLES } from '../../src/config/config.constants.js';
import type { Database } from '../../src/database/database.types.js';
import * as schema from '../../src/database/schema/index.js';

export interface StandaloneDatabase {
  database: Database;
  pool: Pool;
  url: string;
}

export function getDatabaseUrl(): string {
  const url = process.env[ENVIRONMENT_VARIABLES.databaseUrl];

  if (url === undefined) {
    throw new Error('DATABASE_URL is required');
  }

  const parsed = new URL(url);

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol');
  }

  return url;
}

export function createStandaloneDatabase(url = getDatabaseUrl()): StandaloneDatabase {
  const pool = new Pool({ connectionString: url, max: 1 });
  return {
    database: drizzle({ client: pool, schema }),
    pool,
    url,
  };
}

export async function runDatabaseCommand(
  command: (connection: StandaloneDatabase) => Promise<void>,
): Promise<void> {
  const connection = createStandaloneDatabase();

  try {
    await command(connection);
  } finally {
    await connection.pool.end();
  }
}
