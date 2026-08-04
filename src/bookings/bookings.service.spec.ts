import { calculateBookingPrice } from './bookings.service.js';

describe('booking pricing', () => {
  it('rounds a percentage discount half-up per unit before multiplying quantity', () => {
    expect(calculateBookingPrice(105, '10.00', 3)).toEqual({
      discountCents: 11,
      discountedUnitPriceCents: 94,
      subtotalCents: 315,
      totalCents: 282,
    });
  });

  it('preserves zero-cost totals', () => {
    expect(calculateBookingPrice(0, null, 2).totalCents).toBe(0);
  });
});
