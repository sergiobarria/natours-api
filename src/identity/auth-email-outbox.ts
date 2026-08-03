import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseUnitOfWork } from '../database/database-unit-of-work.js';
import { TransactionalOutbox } from '../platform/jobs/transactional-outbox.js';
import { AUTH_EMAIL_JOB, type AuthEmailType } from './identity.constants.js';

export interface EnqueueAuthEmail {
  expiresInSeconds: number;
  recipient: string;
  type: AuthEmailType;
  url: string;
}

@Injectable()
export class AuthEmailOutbox {
  constructor(
    @Inject(DatabaseUnitOfWork) private readonly unitOfWork: DatabaseUnitOfWork,
    private readonly outbox: TransactionalOutbox,
  ) {}

  enqueue(message: EnqueueAuthEmail): Promise<void> {
    const digest = createHash('sha256').update(message.url).digest('hex');
    return this.unitOfWork.transaction(async transaction => {
      await this.outbox.enqueue(transaction, {
        idempotencyKey: `${message.type}:${digest}`,
        name: AUTH_EMAIL_JOB,
        payload: { ...message, idempotencyKey: `${message.type}:${digest}` },
      });
    });
  }
}
