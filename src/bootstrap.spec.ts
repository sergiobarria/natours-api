import { isApiDocsEnabled } from './bootstrap.js';
import { APP_ENVIRONMENT } from './config/config.constants.js';

describe('isApiDocsEnabled', () => {
  it('enables API documentation outside production', () => {
    expect(isApiDocsEnabled(APP_ENVIRONMENT.development)).toBe(true);
    expect(isApiDocsEnabled(APP_ENVIRONMENT.test)).toBe(true);
  });

  it('disables API documentation in production', () => {
    expect(isApiDocsEnabled(APP_ENVIRONMENT.production)).toBe(false);
  });
});
