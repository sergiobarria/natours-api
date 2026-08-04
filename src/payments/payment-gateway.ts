export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface CheckoutRequest {
  bookingId: string;
  paymentId: string;
  amountCents: number;
  currency: 'usd';
  description: string;
  quantity: number;
  expiresAt: Date;
  idempotencyKey: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  checkoutId: string;
  url: string;
  paymentId?: string;
}
export interface RefundResult {
  refundId: string;
  status: 'pending' | 'succeeded' | 'failed';
}
export interface RefundInspection extends RefundResult {
  amountCents: number;
}

export type PaymentEvent =
  | {
      id: string;
      type: 'checkout.completed';
      bookingId: string;
      paymentRecordId: string;
      checkoutId: string;
      paymentId: string;
      amountCents: number;
      currency: string;
      paid: boolean;
    }
  | {
      id: string;
      type: 'checkout.expired';
      bookingId: string;
      paymentRecordId: string;
      checkoutId: string;
    }
  | {
      id: string;
      type: 'refund.completed';
      bookingId: string;
      paymentRecordId: string;
      paymentId: string;
      refundId?: string;
      amountRefundedCents: number;
      currency: string;
    };

export interface PaymentGateway {
  createCheckout(input: CheckoutRequest): Promise<CheckoutResult>;
  inspectCheckout(
    checkoutId: string,
  ): Promise<CheckoutResult & { paid: boolean; expired: boolean }>;
  verifyEvent(rawBody: Buffer, signature: string): PaymentEvent;
  requestFullRefund(input: {
    bookingId: string;
    paymentRecordId: string;
    paymentId: string;
    amountCents: number;
    idempotencyKey: string;
  }): Promise<RefundResult>;
  inspectRefund(refundId: string): Promise<RefundInspection>;
}

export class PaymentGatewayError extends Error {
  constructor(
    readonly code: string,
    message = 'The payment provider is temporarily unavailable.',
  ) {
    super(message);
    this.name = PaymentGatewayError.name;
  }
}
