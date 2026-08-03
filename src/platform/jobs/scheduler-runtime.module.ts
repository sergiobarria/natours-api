import { Module } from '@nestjs/common';
import { JobSchedulerLifecycle } from './job-scheduler.lifecycle.js';
import { SchedulerHeartbeat } from '../../process/process-heartbeat.js';

@Module({ providers: [JobSchedulerLifecycle, SchedulerHeartbeat] })
export class SchedulerRuntimeModule {}
