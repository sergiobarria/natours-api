import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller.js';
import { AppConfigService } from './config/app-config.service.js';
import { AppConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { createLoggerOptions } from './logging/logger.config.js';
import { PlatformJobsModule } from './platform/jobs/platform-jobs.module.js';
import { AuditModule } from './audit/audit.module.js';
import { RateLimitModule } from './rate-limit/rate-limit.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { UsersModule } from './users/users.module.js';
import { ToursModule } from './tours/tours.module.js';
import { StorageModule } from './storage/storage.module.js';
import { BookingsModule } from './bookings/bookings.module.js';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    PlatformJobsModule,
    AuditModule,
    RateLimitModule,
    IdentityModule,
    UsersModule,
    StorageModule,
    ToursModule,
    BookingsModule,
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: createLoggerOptions,
    }),
    HealthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
