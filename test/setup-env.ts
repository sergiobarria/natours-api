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
process.env[ENVIRONMENT_VARIABLES.redisKeyPrefix] ??= 'natours-test';
process.env[ENVIRONMENT_VARIABLES.redisConnectTimeoutMs] ??= '1000';
process.env[ENVIRONMENT_VARIABLES.redisCommandTimeoutMs] ??= '1000';
process.env[ENVIRONMENT_VARIABLES.redisMaxRetriesPerRequest] ??= '1';
process.env[ENVIRONMENT_VARIABLES.jobsQueueName] ??= 'natours-test-jobs';
process.env[ENVIRONMENT_VARIABLES.jobsAttempts] ??= '3';
process.env[ENVIRONMENT_VARIABLES.jobsBackoffDelayMs] ??= '10';
process.env[ENVIRONMENT_VARIABLES.jobsBackoffJitter] ??= '0';
process.env[ENVIRONMENT_VARIABLES.jobsWorkerConcurrency] ??= '2';
process.env[ENVIRONMENT_VARIABLES.jobsLockDurationMs] ??= '5000';
process.env[ENVIRONMENT_VARIABLES.jobsMaxStalledCount] ??= '1';
process.env[ENVIRONMENT_VARIABLES.jobsRemoveOnCompleteAgeSeconds] ??= '60';
process.env[ENVIRONMENT_VARIABLES.jobsRemoveOnCompleteCount] ??= '100';
process.env[ENVIRONMENT_VARIABLES.jobsRemoveOnFailAgeSeconds] ??= '60';
process.env[ENVIRONMENT_VARIABLES.jobsRemoveOnFailCount] ??= '100';
process.env[ENVIRONMENT_VARIABLES.outboxPollIntervalMs] ??= '50';
process.env[ENVIRONMENT_VARIABLES.outboxBatchSize] ??= '10';
process.env[ENVIRONMENT_VARIABLES.processShutdownTimeoutMs] ??= '1000';
