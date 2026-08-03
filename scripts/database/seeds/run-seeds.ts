import type { Database } from '../../../src/database/database.types.js';
import type { SeedModule } from './seed.types.js';

export async function runSeeds(database: Database, seeds: readonly SeedModule[]): Promise<void> {
  for (const seed of seeds) {
    await seed.run(database);
    console.info(`Applied seed: ${seed.name}`);
  }
}
