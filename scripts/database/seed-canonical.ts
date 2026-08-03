import { runDatabaseCommand } from './database-command.js';
import { canonicalSeeds } from './seeds/canonical/index.js';
import { runSeeds } from './seeds/run-seeds.js';

await runDatabaseCommand(async ({ database }) => {
  await runSeeds(database, canonicalSeeds);
  console.info('Canonical seeds are up to date.');
});
