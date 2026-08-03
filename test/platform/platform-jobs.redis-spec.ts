import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { z } from 'zod';
import type { AppConfigService } from '../../src/config/app-config.service.js';
import { DatabaseUnitOfWork } from '../../src/database/database-unit-of-work.js';
import { jobEffects } from '../../src/database/schema/platform-jobs.js';
import { BullJobDispatcher } from '../../src/platform/jobs/bull-job-dispatcher.js';
import { JobOperationsService } from '../../src/platform/jobs/job-operations.service.js';
import { JobSchedulerLifecycle } from '../../src/platform/jobs/job-scheduler.lifecycle.js';
import { JobWorkerLifecycle } from '../../src/platform/jobs/job-worker.lifecycle.js';
import { JobRegistry } from '../../src/platform/jobs/job.registry.js';
import { purgeDatabase } from '../../scripts/database/purge-database.js';
import { createTestDatabase, type TestDatabase } from '../database/test-database.js';

async function waitForState(
  queue: Queue,
  id: string,
  expected: 'completed' | 'failed',
): Promise<void> {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if ((await queue.getJobState(id)) === expected) {
      return;
    }
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${id} to become ${expected}`);
}

describe('Redis and BullMQ platform jobs', () => {
  let testDatabase: TestDatabase;
  let producer: Redis;
  let queueEventsConnection: Redis;
  let queue: Queue;
  let queueEvents: QueueEvents;
  let worker: JobWorkerLifecycle;
  let dispatcher: BullJobDispatcher;
  let operations: JobOperationsService;
  let registry: JobRegistry;
  let calls = 0;
  let failuresRemaining = 0;

  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6380';
  const suffix = randomUUID().replaceAll('-', '');
  const config = {
    jobsAttempts: 3,
    jobsBackoffDelayMs: 10,
    jobsBackoffJitter: 0,
    jobsLockDurationMs: 5_000,
    jobsMaxStalledCount: 1,
    jobsQueueName: `platform-jobs-${suffix}`,
    jobsRemoveOnComplete: { age: 60, count: 100 },
    jobsRemoveOnFail: { age: 60, count: 100 },
    jobsWorkerConcurrency: 2,
    redisKeyPrefix: `natours-test-${suffix}`,
  } as AppConfigService;

  beforeAll(async () => {
    testDatabase = await createTestDatabase();
    await testDatabase.migrateProduction();
    producer = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    queueEventsConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    queue = new Queue(config.jobsQueueName, {
      connection: producer,
      prefix: config.redisKeyPrefix,
    });
    queueEvents = new QueueEvents(config.jobsQueueName, {
      connection: queueEventsConnection,
      prefix: config.redisKeyPrefix,
    });
    await queueEvents.waitUntilReady();

    registry = new JobRegistry();
    registry.register({
      handler: {
        execute: () => {
          calls += 1;
          if (failuresRemaining > 0) {
            failuresRemaining -= 1;
            return Promise.reject(new Error('password=hidden queue fixture failure'));
          }
          return Promise.resolve();
        },
      },
      name: 'fixture.effect',
      schedule: {
        id: 'fixture-effect-schedule',
        pattern: '0 0 1 1 *',
        payload: { value: 'scheduled' },
      },
      schema: z.object({ value: z.string() }),
    });

    const unitOfWork = new DatabaseUnitOfWork(testDatabase.database);
    worker = new JobWorkerLifecycle(
      config,
      registry,
      unitOfWork,
      () => new Redis(redisUrl, { maxRetriesPerRequest: null }),
    );
    dispatcher = new BullJobDispatcher(queue, config, registry);
    operations = new JobOperationsService(queue);
    worker.onModuleInit();
  });

  beforeEach(async () => {
    calls = 0;
    failuresRemaining = 0;
    await queue.drain(true);
    await queue.clean(0, 1_000, 'completed');
    await queue.clean(0, 1_000, 'failed');
    await purgeDatabase(testDatabase.pool, testDatabase.url);
  });

  afterAll(async () => {
    await worker.onApplicationShutdown();
    await queueEvents.close();
    await queue.obliterate({ force: true });
    await queue.close();
    if (producer.status !== 'end') {
      await producer.quit();
    }
    if (queueEventsConnection.status !== 'end') {
      await queueEventsConnection.quit();
    }
    await testDatabase.release();
  });

  it('deduplicates delivery and commits one domain effect', async () => {
    const first = await dispatcher.dispatch({
      idempotencyKey: 'fixture:deduplicate',
      name: 'fixture.effect',
      payload: { value: 'first' },
    });
    const second = await dispatcher.dispatch({
      idempotencyKey: 'fixture:deduplicate',
      name: 'fixture.effect',
      payload: { value: 'second' },
    });
    expect(second.id).toBe(first.id);
    await waitForState(queue, first.id, 'completed');

    expect(calls).toBe(1);
    expect(await testDatabase.database.select().from(jobEffects)).toHaveLength(1);
  });

  it('rolls back the effect claim before a bounded retry succeeds', async () => {
    failuresRemaining = 1;
    const queued = await dispatcher.dispatch({
      idempotencyKey: 'fixture:retry',
      name: 'fixture.effect',
      payload: { value: 'retry' },
    });
    await waitForState(queue, queued.id, 'completed');

    expect(calls).toBe(2);
    expect(await testDatabase.database.select().from(jobEffects)).toHaveLength(1);
  });

  it('retains, redacts, and replays a terminal failure', async () => {
    failuresRemaining = 3;
    const queued = await dispatcher.dispatch({
      idempotencyKey: 'fixture:failure',
      name: 'fixture.effect',
      payload: { value: 'failure' },
    });
    await waitForState(queue, queued.id, 'failed');

    const inspected = await operations.inspect(queued.id);
    expect(inspected?.failedReason).toContain('password=[Redacted]');
    expect(inspected?.failedReason).not.toContain('password=hidden');

    failuresRemaining = 0;
    await operations.replay(queued.id, 'failed');
    await waitForState(queue, queued.id, 'completed');
    expect(await testDatabase.database.select().from(jobEffects)).toHaveLength(1);
  });

  it('upserts a scheduler without duplicating its definition', async () => {
    const scheduler = new JobSchedulerLifecycle(queue, registry, config);
    await scheduler.onModuleInit();
    await scheduler.onModuleInit();
    const schedulers = await queue.getJobSchedulers();

    expect(schedulers.filter(item => item.key === 'fixture-effect-schedule')).toHaveLength(1);
  });
});
