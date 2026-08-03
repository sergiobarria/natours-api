import { isApiDocsEnabled } from './bootstrap';

describe('isApiDocsEnabled', () => {
  it('enables API documentation outside production', () => {
    expect(isApiDocsEnabled('development')).toBe(true);
    expect(isApiDocsEnabled('test')).toBe(true);
  });

  it('disables API documentation in production', () => {
    expect(isApiDocsEnabled('production')).toBe(false);
  });
});
