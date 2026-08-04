import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  CheckoutRequest,
  CheckoutResult,
  PaymentEvent,
  PaymentGateway,
  RefundInspection,
  RefundResult,
} from './payment-gateway.js';
import { PaymentGatewayError } from './payment-gateway.js';

@Injectable()
export class FakePaymentGateway implements PaymentGateway {
  failCheckout = false;
  failRefund = false;
  readonly checkouts = new Map<string, CheckoutResult>();

  createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
    if (this.failCheckout) throw new PaymentGatewayError('checkout_unavailable');
    const existing = this.checkouts.get(input.idempotencyKey);
    if (existing) return Promise.resolve(existing);
    const suffix = createHash('sha256').update(input.idempotencyKey).digest('hex').slice(0, 20);
    const result = {
      checkoutId: `cs_fake_${suffix}`,
      url: `https://checkout.example/${suffix}`,
      paymentId: `pi_fake_${suffix}`,
    };
    this.checkouts.set(input.idempotencyKey, result);
    return Promise.resolve(result);
  }

  inspectCheckout(checkoutId: string) {
    const result = [...this.checkouts.values()].find(value => value.checkoutId === checkoutId);
    if (!result) throw new PaymentGatewayError('checkout_not_found');
    return Promise.resolve({ ...result, paid: false, expired: false });
  }

  verifyEvent(rawBody: Buffer, signature: string): PaymentEvent {
    if (signature !== 'fake-valid-signature')
      throw new PaymentGatewayError('invalid_signature', 'Invalid payment signature.');
    return JSON.parse(rawBody.toString('utf8')) as PaymentEvent;
  }

  requestFullRefund(input: { idempotencyKey: string }): Promise<RefundResult> {
    if (this.failRefund) throw new PaymentGatewayError('refund_unavailable');
    return Promise.resolve({
      refundId: `re_fake_${createHash('sha256').update(input.idempotencyKey).digest('hex').slice(0, 20)}`,
      status: 'pending',
    });
  }

  inspectRefund(refundId: string): Promise<RefundInspection> {
    return Promise.resolve({ refundId, status: 'pending', amountCents: 0 });
  }
}
