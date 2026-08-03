import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigService } from './config/app-config.service.js';
import { AppConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { createLoggerOptions } from './logging/logger.config.js';
import { JobOperationsService } from './platform/jobs/job-operations.service.js';
import { PROCESS_ROLE } from './platform/jobs/job.constants.js';
import { PlatformJobsModule } from './platform/jobs/platform-jobs.module.js';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    PlatformJobsModule,
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => createLoggerOptions(config, PROCESS_ROLE.worker),
    }),
  ],
  providers: [JobOperationsService],
  exports: [JobOperationsService],
})
export class OperationsAppModule {}
