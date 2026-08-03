import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from './database.constants.js';
import type { Database, DatabaseTransaction } from './database.types.js';

@Injectable()
export class DatabaseUnitOfWork {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  transaction<T>(work: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    return this.database.transaction(work);
  }
}
