import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller.js';
import { AppConfigService } from './config/app-config.service.js';
import { AppConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { createLoggerOptions } from './logging/logger.config.js';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
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
