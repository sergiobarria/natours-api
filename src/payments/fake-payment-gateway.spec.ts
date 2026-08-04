import { FakePaymentGateway } from './fake-payment-gateway.js';

const request = {
  bookingId: 'booking',
  paymentId: 'payment',
  amountCents: 1000,
  currency: 'usd' as const,
  description: 'Tour',
  quantity: 1,
  expiresAt: new Date(Date.now() + 60_000),
  idempotencyKey: 'stable-key',
  successUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel',
};

describe('FakePaymentGateway', () => {
  it('returns one deterministic Checkout session for repeated idempotency keys', async () => {
    const gateway = new FakePaymentGateway();
    expect(await gateway.createCheckout(request)).toEqual(await gateway.createCheckout(request));
    expect(gateway.checkouts.size).toBe(1);
  });

  it('supports deterministic provider failure testing', () => {
    const gateway = new FakePaymentGateway();
    gateway.failCheckout = true;
    expect(() => gateway.createCheckout(request)).toThrow('temporarily unavailable');
  });
});
