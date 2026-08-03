import { Module } from '@nestjs/common';
import { JobSchedulerLifecycle } from './job-scheduler.lifecycle.js';

@Module({ providers: [JobSchedulerLifecycle] })
export class SchedulerRuntimeModule {}
