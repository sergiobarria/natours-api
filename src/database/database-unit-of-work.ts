import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from './database.constants.js';
import type { Database, DatabaseTransaction } from './database.types.js';

declare const transactionContextBrand: unique symbol;

export interface TransactionContext {
  readonly [transactionContextBrand]: true;
}

interface TransactionState {
  database: DatabaseTransaction;
}

const transactionStates = new WeakMap<TransactionContext, TransactionState>();

function createTransactionContext(transaction: DatabaseTransaction): TransactionContext {
  const context = Object.freeze({}) as TransactionContext;
  transactionStates.set(context, { database: transaction });
  return context;
}

export function getTransactionDatabase(context: TransactionContext): DatabaseTransaction {
  const transaction = transactionStates.get(context)?.database;

  if (!transaction) {
    throw new Error('The transaction context is invalid or no longer available');
  }

  return transaction;
}

@Injectable()
export class DatabaseUnitOfWork {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async transaction<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    return this.database.transaction(async transaction => {
      const context = createTransactionContext(transaction);

      try {
        return await work(context);
      } finally {
        transactionStates.delete(context);
      }
    });
  }
}
