import { assertCleanupAllowed } from './cleanup.js';

describe('media cleanup safety', () => {
  it.each(['production', 'staging', undefined])('refuses execution in %s', environment => {
    expect(() => assertCleanupAllowed(environment, true)).toThrow(/restricted/);
  });

  it('allows dry runs everywhere and execution only in development/test', () => {
    expect(() => assertCleanupAllowed('production', false)).not.toThrow();
    expect(() => assertCleanupAllowed('development', true)).not.toThrow();
    expect(() => assertCleanupAllowed('test', true)).not.toThrow();
  });
});
