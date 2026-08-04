import { Module } from '@nestjs/common';
import { IdentityEmailModule } from '../../identity/identity-email.module.js';
import { JobWorkerLifecycle } from './job-worker.lifecycle.js';
import { OutboxRelay } from './outbox-relay.js';
import { BookingsModule } from '../../bookings/bookings.module.js';

@Module({
  imports: [IdentityEmailModule, BookingsModule],
  providers: [JobWorkerLifecycle, OutboxRelay],
})
export class WorkerRuntimeModule {}
