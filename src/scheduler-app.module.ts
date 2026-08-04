import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config/config.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { createLoggerOptions } from './logging/logger.config.js';
import { JobSchedulerLifecycle } from './platform/jobs/job-scheduler.lifecycle.js';
import { PROCESS_ROLE } from './platform/jobs/job.constants.js';
import { PlatformJobsModule } from './platform/jobs/platform-jobs.module.js';

@Module({
  imports: [
    AppConfigModule,
    PlatformJobsModule,
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => createLoggerOptions(config, PROCESS_ROLE.scheduler),
    }),
  ],
  providers: [JobSchedulerLifecycle],
})
export class SchedulerAppModule {}
