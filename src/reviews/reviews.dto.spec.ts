import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReviewBodyDto, UpdateReviewDto } from './reviews.dto.js';

describe('review DTOs', () => {
  it.each([0, 6, 1.5])('rejects invalid rating %s', async rating => {
    const errors = await validate(plainToInstance(ReviewBodyDto, { rating, text: 'Useful' }));
    expect(errors.some(error => error.property === 'rating')).toBe(true);
  });

  it('trims text and rejects blank or oversized reviews', async () => {
    const valid = plainToInstance(ReviewBodyDto, { rating: 5, text: '  Excellent trip  ' });
    expect(await validate(valid)).toEqual([]);
    expect(valid.text).toBe('Excellent trip');
    for (const text of ['   ', 'x'.repeat(2001)]) {
      const errors = await validate(plainToInstance(ReviewBodyDto, { rating: 5, text }));
      expect(errors.some(error => error.property === 'text')).toBe(true);
    }
  });

  it('allows partial updates while validating supplied values', async () => {
    expect(await validate(plainToInstance(UpdateReviewDto, { rating: 4 }))).toEqual([]);
    const errors = await validate(plainToInstance(UpdateReviewDto, { text: ' ' }));
    expect(errors.some(error => error.property === 'text')).toBe(true);
  });
});
