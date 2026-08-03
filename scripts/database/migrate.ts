import { runDatabaseCommand } from './database-command.js';
import { migrateDatabase } from './migration.js';

await runDatabaseCommand(async ({ database }) => {
  await migrateDatabase(database);
  console.info('Database migrations are up to date.');
});
