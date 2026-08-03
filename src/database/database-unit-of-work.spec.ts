import type { Database } from './database.types.js';
import {
  AfterCommitDispatcher,
  DatabaseUnitOfWork,
  getTransactionDatabase,
  type TransactionContext,
} from './database-unit-of-work.js';

function createUnitOfWork(): DatabaseUnitOfWork {
  const database = {
    transaction: async <T>(work: (transaction: object) => Promise<T>) => work({}),
  } as Database;
  return new DatabaseUnitOfWork(database);
}

describe('DatabaseUnitOfWork after-commit dispatch', () => {
  it('runs registered callbacks once and only after commit', async () => {
    const unitOfWork = createUnitOfWork();
    const dispatcher = new AfterCommitDispatcher();
    const calls: string[] = [];

    await unitOfWork.transaction(context => {
      expect(getTransactionDatabase(context)).toBeDefined();
      dispatcher.defer(context, () => {
        calls.push('after-commit');
      });
      calls.push('transaction');
      return Promise.resolve();
    });

    expect(calls).toEqual(['transaction', 'after-commit']);
  });

  it('discards callbacks when the transaction rolls back', async () => {
    const unitOfWork = createUnitOfWork();
    const dispatcher = new AfterCommitDispatcher();
    let called = false;

    await expect(
      unitOfWork.transaction(context => {
        dispatcher.defer(context, () => {
          called = true;
        });
        return Promise.reject(new Error('rollback'));
      }),
    ).rejects.toThrow('rollback');

    expect(called).toBe(false);
  });

  it('rejects registration with an inactive context', () => {
    const dispatcher = new AfterCommitDispatcher();
    expect(() => dispatcher.defer({} as TransactionContext, () => undefined)).toThrow(
      'After-commit work requires an active transaction context',
    );
  });
});
