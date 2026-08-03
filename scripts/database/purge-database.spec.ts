import { APP_ENVIRONMENT } from '../../src/config/config.constants.js';
import { assertDatabaseCanBePurged } from './purge-database.js';

const developmentDatabaseUrl = 'postgresql://database-user@database-host:5432/development_db';
const testDatabaseUrl = 'postgresql://database-user@database-host:5432/test_db';
const allowedDatabaseNames = 'development_db,test_db';

describe('database purge safety', () => {
  it('allows the dedicated development and test databases', () => {
    expect(() =>
      assertDatabaseCanBePurged(developmentDatabaseUrl, undefined, undefined, allowedDatabaseNames),
    ).not.toThrow();
    expect(() =>
      assertDatabaseCanBePurged(testDatabaseUrl, undefined, undefined, allowedDatabaseNames),
    ).not.toThrow();
    expect(() =>
      assertDatabaseCanBePurged(
        `${testDatabaseUrl}_w_1_run`,
        undefined,
        undefined,
        allowedDatabaseNames,
      ),
    ).not.toThrow();
  });

  it('refuses production regardless of the database name or override', () => {
    expect(() =>
      assertDatabaseCanBePurged(
        developmentDatabaseUrl,
        APP_ENVIRONMENT.production,
        'true',
        allowedDatabaseNames,
      ),
    ).toThrow('Database purge is disabled in production');
  });

  it('requires an explicit override for nonstandard database names', () => {
    const customUrl = 'postgresql://database-user@database-host:5432/custom_database';
    expect(() =>
      assertDatabaseCanBePurged(customUrl, undefined, undefined, allowedDatabaseNames),
    ).toThrow('Refusing to purge database');
    expect(() => assertDatabaseCanBePurged(customUrl, APP_ENVIRONMENT.test, 'true')).not.toThrow();
  });
});
