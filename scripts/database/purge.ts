import { runDatabaseCommand } from './database-command.js';
import { purgeDatabase } from './purge-database.js';

await runDatabaseCommand(async ({ pool, url }) => {
  const tableCount = await purgeDatabase(pool, url);
  console.info(`Purged ${tableCount} application table(s); migration history was preserved.`);
});
