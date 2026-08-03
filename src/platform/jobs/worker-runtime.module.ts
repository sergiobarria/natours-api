import { Module } from '@nestjs/common';
import { IdentityEmailModule } from '../../identity/identity-email.module.js';
import { JobWorkerLifecycle } from './job-worker.lifecycle.js';
import { OutboxRelay } from './outbox-relay.js';

@Module({ imports: [IdentityEmailModule], providers: [JobWorkerLifecycle, OutboxRelay] })
export class WorkerRuntimeModule {}
