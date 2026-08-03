import { Inject, Injectable, Logger } from '@nestjs/common';
import { sanitizeOperationalError } from '../security/sensitive-data.js';
import { DATABASE } from './database.constants.js';
import type { Database, DatabaseTransaction } from './database.types.js';

declare const transactionContextBrand: unique symbol;

export interface TransactionContext {
  readonly [transactionContextBrand]: true;
}

interface TransactionState {
  afterCommit: Array<() => Promise<void> | void>;
  database: DatabaseTransaction;
}

const transactionStates = new WeakMap<TransactionContext, TransactionState>();

function createTransactionContext(transaction: DatabaseTransaction): TransactionContext {
  const context = Object.freeze({}) as TransactionContext;
  transactionStates.set(context, { afterCommit: [], database: transaction });
  return context;
}

export function getTransactionDatabase(context: TransactionContext): DatabaseTransaction {
  const transaction = transactionStates.get(context)?.database;

  if (!transaction) {
    throw new Error('The transaction context is invalid or no longer available');
  }

  return transaction;
}

function registerAfterCommit(
  context: TransactionContext,
  callback: () => Promise<void> | void,
): void {
  const state = transactionStates.get(context);

  if (!state) {
    throw new Error('After-commit work requires an active transaction context');
  }

  state.afterCommit.push(callback);
}

@Injectable()
export class AfterCommitDispatcher {
  defer(context: TransactionContext, callback: () => Promise<void> | void): void {
    registerAfterCommit(context, callback);
  }
}

@Injectable()
export class DatabaseUnitOfWork {
  private readonly logger = new Logger(DatabaseUnitOfWork.name);

  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async transaction<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    let callbacks: Array<() => Promise<void> | void> = [];
    const result = await this.database.transaction(async transaction => {
      const context = createTransactionContext(transaction);

      try {
        return await work(context);
      } finally {
        callbacks = transactionStates.get(context)?.afterCommit ?? [];
        transactionStates.delete(context);
      }
    });

    for (const callback of callbacks) {
      try {
        await callback();
      } catch (error) {
        this.logger.error({ err: sanitizeOperationalError(error) }, 'Post-commit callback failed');
      }
    }

    return result;
  }
}
