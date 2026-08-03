import { runDatabaseCommand } from './database-command.js';
import { demoSeeds } from './seeds/demo/index.js';
import { runSeeds } from './seeds/run-seeds.js';

await runDatabaseCommand(async ({ database }) => {
  await runSeeds(database, demoSeeds);
  console.info('Demo seeds are up to date.');
});
