import { Module } from '@nestjs/common';
import { SensitiveResponseInterceptor } from '../http/response/sensitive-response.interceptor.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { BookingsController, StripeWebhookController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { AppConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [AppConfigModule, DatabaseModule, AuditModule, PaymentsModule],
  controllers: [BookingsController, StripeWebhookController],
  providers: [BookingsService, SensitiveResponseInterceptor],
  exports: [BookingsService],
})
export class BookingsModule {}
