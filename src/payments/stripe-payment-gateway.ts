import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { AppConfigService } from '../config/app-config.service.js';
import type { CheckoutRequest, PaymentEvent, PaymentGateway } from './payment-gateway.js';
import { PaymentGatewayError } from './payment-gateway.js';

@Injectable()
export class StripePaymentGateway implements PaymentGateway {
  private readonly stripe: Stripe;
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {
    this.stripe = new Stripe(config.stripeSecretKey || 'sk_test_not_configured');
  }

  async createCheckout(input: CheckoutRequest) {
    try {
      const session = await this.stripe.checkout.sessions.create(
        {
          mode: 'payment',
          payment_method_types: ['card'],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          expires_at: Math.floor(input.expiresAt.getTime() / 1000),
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: input.currency,
                unit_amount: input.amountCents,
                product_data: { name: input.description },
              },
            },
          ],
          metadata: { bookingId: input.bookingId, paymentRecordId: input.paymentId },
          payment_intent_data: {
            metadata: { bookingId: input.bookingId, paymentRecordId: input.paymentId },
          },
        },
        { idempotencyKey: input.idempotencyKey },
      );
      if (!session.url) throw new PaymentGatewayError('missing_checkout_url');
      return {
        checkoutId: session.id,
        url: session.url,
        paymentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id,
      };
    } catch (error) {
      throw translate(error, 'checkout_failed');
    }
  }

  async inspectCheckout(checkoutId: string) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(checkoutId);
      return {
        checkoutId: session.id,
        url: session.url ?? '',
        paymentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id,
        paid: session.payment_status === 'paid',
        expired: session.status === 'expired',
      };
    } catch (error) {
      throw translate(error, 'checkout_inspection_failed');
    }
  }

  verifyEvent(rawBody: Buffer, signature: string): PaymentEvent {
    try {
      return normalize(
        this.stripe.webhooks.constructEvent(rawBody, signature, this.config.stripeWebhookSecret),
      );
    } catch (error) {
      throw translate(error, 'invalid_signature', 'Invalid payment signature.');
    }
  }

  async requestFullRefund(input: {
    bookingId: string;
    paymentRecordId: string;
    paymentId: string;
    idempotencyKey: string;
  }) {
    try {
      const refund = await this.stripe.refunds.create(
        {
          payment_intent: input.paymentId,
          metadata: { bookingId: input.bookingId, paymentRecordId: input.paymentRecordId },
        },
        { idempotencyKey: input.idempotencyKey },
      );
      return {
        refundId: refund.id,
        status:
          refund.status === 'succeeded'
            ? ('succeeded' as const)
            : refund.status === 'failed' || refund.status === 'canceled'
              ? ('failed' as const)
              : ('pending' as const),
      };
    } catch (error) {
      throw translate(error, 'refund_failed');
    }
  }

  async inspectRefund(refundId: string) {
    try {
      const refund = await this.stripe.refunds.retrieve(refundId);
      return {
        refundId,
        amountCents: refund.amount,
        status:
          refund.status === 'succeeded'
            ? ('succeeded' as const)
            : refund.status === 'failed' || refund.status === 'canceled'
              ? ('failed' as const)
              : ('pending' as const),
      };
    } catch (error) {
      throw translate(error, 'refund_inspection_failed');
    }
  }
}

function normalize(event: Stripe.Event): PaymentEvent {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const paymentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!session.metadata?.bookingId || !session.metadata.paymentRecordId || !paymentId)
      throw new PaymentGatewayError(
        'event_metadata_mismatch',
        'Payment event does not match a booking.',
      );
    return {
      id: event.id,
      type: 'checkout.completed',
      bookingId: session.metadata.bookingId,
      paymentRecordId: session.metadata.paymentRecordId,
      checkoutId: session.id,
      paymentId,
      amountCents: session.amount_total ?? -1,
      currency: session.currency ?? '',
      paid: session.payment_status === 'paid',
    };
  }
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object;
    if (!session.metadata?.bookingId || !session.metadata.paymentRecordId)
      throw new PaymentGatewayError(
        'event_metadata_mismatch',
        'Payment event does not match a booking.',
      );
    return {
      id: event.id,
      type: 'checkout.expired',
      bookingId: session.metadata.bookingId,
      paymentRecordId: session.metadata.paymentRecordId,
      checkoutId: session.id,
    };
  }
  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    const paymentId =
      typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    if (!charge.metadata?.bookingId || !charge.metadata.paymentRecordId || !paymentId)
      throw new PaymentGatewayError(
        'event_metadata_mismatch',
        'Payment event does not match a booking.',
      );
    return {
      id: event.id,
      type: 'refund.completed',
      bookingId: charge.metadata.bookingId,
      paymentRecordId: charge.metadata.paymentRecordId,
      paymentId,
      amountRefundedCents: charge.amount_refunded,
      currency: charge.currency,
    };
  }
  throw new PaymentGatewayError('unsupported_event', 'Unsupported payment event.');
}

function translate(error: unknown, code: string, message?: string): PaymentGatewayError {
  if (error instanceof PaymentGatewayError) return error;
  return new PaymentGatewayError(code, message);
}
