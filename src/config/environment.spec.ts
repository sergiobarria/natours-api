import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('applies development defaults', () => {
    expect(validateEnvironment({})).toEqual({
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 3000,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: ['http://localhost:3000', 'http://localhost:5173'],
    });
  });

  it('coerces the port and parses configured origins', () => {
    const config = validateEnvironment({
      NODE_ENV: 'test',
      PORT: '4000',
      CORS_ORIGINS: 'https://example.com, https://admin.example.com',
    });

    expect(config.PORT).toBe(4000);
    expect(config.CORS_ORIGINS).toEqual(['https://example.com', 'https://admin.example.com']);
  });

  it('rejects invalid ports', () => {
    expect(() => validateEnvironment({ PORT: 'not-a-port' })).toThrow();
  });

  it('rejects invalid CORS origins and log levels', () => {
    expect(() => validateEnvironment({ CORS_ORIGINS: 'not-a-url' })).toThrow();
    expect(() => validateEnvironment({ LOG_LEVEL: 'verbose' })).toThrow();
  });

  it('requires explicit CORS origins in production', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      'CORS_ORIGINS is required in production',
    );
  });
});
