import 'dotenv/config';
import { DATABASE_SCRIPT_ENVIRONMENT_VARIABLES } from '../scripts/database/database-script.constants.js';
import { APP_ENVIRONMENT, ENVIRONMENT_VARIABLES } from '../src/config/config.constants.js';

process.env[ENVIRONMENT_VARIABLES.nodeEnv] = APP_ENVIRONMENT.test;
const testDatabaseUrl = process.env[DATABASE_SCRIPT_ENVIRONMENT_VARIABLES.testDatabaseUrl];
process.env[ENVIRONMENT_VARIABLES.databaseUrl] ??= testDatabaseUrl;

if (testDatabaseUrl !== undefined) {
  const testDatabaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.slice(1));
  process.env[DATABASE_SCRIPT_ENVIRONMENT_VARIABLES.resetAllowedDatabases] ??= testDatabaseName;
}

process.env[ENVIRONMENT_VARIABLES.logLevel] = 'silent';
