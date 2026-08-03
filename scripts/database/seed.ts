import { runDatabaseCommand } from './database-command.js';
import { canonicalSeeds } from './seeds/canonical/index.js';
import { demoSeeds } from './seeds/demo/index.js';
import { runSeeds } from './seeds/run-seeds.js';

await runDatabaseCommand(async ({ database }) => {
  await runSeeds(database, canonicalSeeds);
  await runSeeds(database, demoSeeds);
  console.info('Canonical and demo seeds are up to date.');
});
