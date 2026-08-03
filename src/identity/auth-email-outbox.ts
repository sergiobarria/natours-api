import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseUnitOfWork } from '../database/database-unit-of-work.js';
import { OUTBOX } from '../platform/jobs/job.constants.js';
import type { TransactionalOutbox } from '../platform/jobs/job.types.js';
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
    @Inject(OUTBOX) private readonly outbox: TransactionalOutbox,
  ) {}

  enqueue(message: EnqueueAuthEmail): Promise<void> {
    const digest = createHash('sha256').update(message.url).digest('hex');
    return this.unitOfWork.transaction(async context => {
      await this.outbox.enqueue(context, {
        idempotencyKey: `${message.type}:${digest}`,
        name: AUTH_EMAIL_JOB,
        payload: { ...message, idempotencyKey: `${message.type}:${digest}` },
      });
    });
  }
}
