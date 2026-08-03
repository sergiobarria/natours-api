import { runDatabaseCommand } from './database-command.js';
import { migrateDatabase } from './migration.js';
import { purgeDatabase } from './purge-database.js';
import { canonicalSeeds } from './seeds/canonical/index.js';
import { demoSeeds } from './seeds/demo/index.js';
import { runSeeds } from './seeds/run-seeds.js';

await runDatabaseCommand(async ({ database, pool, url }) => {
  await purgeDatabase(pool, url);
  await migrateDatabase(database);
  await runSeeds(database, canonicalSeeds);
  await runSeeds(database, demoSeeds);
  console.info('Database reset completed.');
});
