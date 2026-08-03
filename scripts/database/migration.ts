import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from '../../src/database/database.types.js';

export const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function migrateDatabase(database: Database): Promise<void> {
  await migrate(database, { migrationsFolder });
}
