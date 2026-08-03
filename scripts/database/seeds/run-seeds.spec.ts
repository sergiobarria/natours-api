import type { Database } from '../../../src/database/database.types.js';
import { runSeeds } from './run-seeds.js';
import type { SeedModule } from './seed.types.js';

describe('seed orchestration', () => {
  it('runs seed modules sequentially in registry order', async () => {
    const calls: string[] = [];
    const database = {} as Database;
    const seeds: readonly SeedModule[] = [
      { name: 'roles', run: () => Promise.resolve(void calls.push('roles')) },
      { name: 'permissions', run: () => Promise.resolve(void calls.push('permissions')) },
    ];

    await runSeeds(database, seeds);

    expect(calls).toEqual(['roles', 'permissions']);
  });
});
