import { Module } from '@nestjs/common';
import { JobWorkerLifecycle } from './job-worker.lifecycle.js';
import { OutboxRelay } from './outbox-relay.js';

@Module({ providers: [JobWorkerLifecycle, OutboxRelay] })
export class WorkerRuntimeModule {}
