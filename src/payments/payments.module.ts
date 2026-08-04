import { Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { FakePaymentGateway } from './fake-payment-gateway.js';
import { PAYMENT_GATEWAY } from './payment-gateway.js';
import { StripePaymentGateway } from './stripe-payment-gateway.js';

@Module({
  providers: [
    FakePaymentGateway,
    StripePaymentGateway,
    {
      provide: PAYMENT_GATEWAY,
      inject: [AppConfigService, FakePaymentGateway, StripePaymentGateway],
      useFactory: (
        config: AppConfigService,
        fake: FakePaymentGateway,
        stripe: StripePaymentGateway,
      ) => (config.paymentProvider === 'stripe' ? stripe : fake),
    },
  ],
  exports: [PAYMENT_GATEWAY, FakePaymentGateway],
})
export class PaymentsModule {}
