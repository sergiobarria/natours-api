import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppConfigService } from './config/app-config.service';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { createLoggerOptions } from './logging/logger.config';

@Module({
  imports: [
    AppConfigModule,
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
