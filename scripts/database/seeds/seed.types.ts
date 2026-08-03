import type { Database } from '../../../src/database/database.types.js';

export interface SeedModule {
  name: string;
  run(database: Database): Promise<void>;
}
