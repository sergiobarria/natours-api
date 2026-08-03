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
process.env[ENVIRONMENT_VARIABLES.redisUrl] ??= 'redis://localhost:6380';
process.env[ENVIRONMENT_VARIABLES.redisKeyPrefix] ??= `natours-test-${process.pid}`;
process.env[ENVIRONMENT_VARIABLES.jobsQueueName] ??= 'natours-test-jobs';
process.env[ENVIRONMENT_VARIABLES.jobsWorkerConcurrency] ??= '2';
process.env[ENVIRONMENT_VARIABLES.trustedProxyCidrs] ??= '';
process.env[ENVIRONMENT_VARIABLES.rateLimitGlobalLimit] ??= '1000';
process.env[ENVIRONMENT_VARIABLES.rateLimitGlobalTtlMs] ??= '60000';
process.env[ENVIRONMENT_VARIABLES.rateLimitGlobalBlockMs] ??= '60000';
process.env[ENVIRONMENT_VARIABLES.rateLimitAuthLimit] ??= '1000';
process.env[ENVIRONMENT_VARIABLES.rateLimitAuthTtlMs] ??= '60000';
process.env[ENVIRONMENT_VARIABLES.rateLimitAuthBlockMs] ??= '60000';
process.env[ENVIRONMENT_VARIABLES.rateLimitAccountLimit] ??= '1000';
process.env[ENVIRONMENT_VARIABLES.rateLimitAccountTtlMs] ??= '60000';
process.env[ENVIRONMENT_VARIABLES.rateLimitAccountBlockMs] ??= '60000';
process.env[ENVIRONMENT_VARIABLES.appUrl] ??= 'http://localhost:3000';
process.env[ENVIRONMENT_VARIABLES.frontendUrl] ??= 'http://localhost:5173';
process.env[ENVIRONMENT_VARIABLES.betterAuthUrl] ??= 'http://localhost:3000';
process.env[ENVIRONMENT_VARIABLES.betterAuthSecret] ??=
  'test-only-better-auth-secret-32-characters';
process.env[ENVIRONMENT_VARIABLES.betterAuthTrustedOrigins] ??= 'http://localhost:5173';
process.env[ENVIRONMENT_VARIABLES.emailProvider] ??= 'fake';
process.env[ENVIRONMENT_VARIABLES.resendApiKey] ??= '';
process.env[ENVIRONMENT_VARIABLES.mailFromAddress] ??= 'hello@example.com';
process.env[ENVIRONMENT_VARIABLES.mailFromName] ??= 'Natours';
