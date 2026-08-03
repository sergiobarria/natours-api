import { validateEnvironment } from './environment.js';
import { APP_ENVIRONMENT, DATABASE_DEFAULTS } from './config.constants.js';

const databaseEnvironment = {
  DATABASE_URL: 'postgresql://database-user@database-host:5432/database-name',
};

describe('validateEnvironment', () => {
  it('applies development defaults', () => {
    expect(validateEnvironment(databaseEnvironment)).toEqual({
      NODE_ENV: APP_ENVIRONMENT.development,
      HOST: '0.0.0.0',
      PORT: 3000,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: ['http://localhost:3000', 'http://localhost:5173'],
      DATABASE_URL: databaseEnvironment.DATABASE_URL,
      DATABASE_POOL_MAX: DATABASE_DEFAULTS.poolMax,
      DATABASE_POOL_IDLE_TIMEOUT_MS: DATABASE_DEFAULTS.poolIdleTimeoutMs,
      DATABASE_POOL_CONNECTION_TIMEOUT_MS: DATABASE_DEFAULTS.poolConnectionTimeoutMs,
    });
  });

  it('coerces the port and parses configured origins', () => {
    const config = validateEnvironment({
      ...databaseEnvironment,
      NODE_ENV: APP_ENVIRONMENT.test,
      PORT: '4000',
      CORS_ORIGINS: 'https://example.com, https://admin.example.com',
    });

    expect(config.PORT).toBe(4000);
    expect(config.CORS_ORIGINS).toEqual(['https://example.com', 'https://admin.example.com']);
  });

  it('rejects invalid ports', () => {
    expect(() => validateEnvironment({ ...databaseEnvironment, PORT: 'not-a-port' })).toThrow();
  });

  it('rejects invalid CORS origins and log levels', () => {
    expect(() =>
      validateEnvironment({ ...databaseEnvironment, CORS_ORIGINS: 'not-a-url' }),
    ).toThrow();
    expect(() => validateEnvironment({ ...databaseEnvironment, LOG_LEVEL: 'verbose' })).toThrow();
  });

  it('requires explicit CORS origins in production', () => {
    expect(() =>
      validateEnvironment({ ...databaseEnvironment, NODE_ENV: APP_ENVIRONMENT.production }),
    ).toThrow('CORS_ORIGINS is required in production');
  });

  it('requires a PostgreSQL database URL', () => {
    expect(() => validateEnvironment({})).toThrow();
    expect(() => validateEnvironment({ DATABASE_URL: 'https://example.com/database' })).toThrow(
      'DATABASE_URL must use the postgres or postgresql protocol',
    );
  });
});
