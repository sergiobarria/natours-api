import { Module } from '@nestjs/common';
import { JobWorkerLifecycle } from './job-worker.lifecycle.js';
import { OutboxRelay } from './outbox-relay.js';
import { WorkerHeartbeat } from '../../process/process-heartbeat.js';

@Module({ providers: [JobWorkerLifecycle, OutboxRelay, WorkerHeartbeat] })
export class WorkerRuntimeModule {}
