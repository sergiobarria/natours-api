import { Module } from '@nestjs/common';
import { SensitiveResponseInterceptor } from '../http/response/sensitive-response.interceptor.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, SensitiveResponseInterceptor],
})
export class AnalyticsModule {}
