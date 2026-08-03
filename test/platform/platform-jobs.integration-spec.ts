import { eq } from 'drizzle-orm';
import { DatabaseUnitOfWork } from '../../src/database/database-unit-of-work.js';
import { outboxMessages } from '../../src/database/schema/platform-jobs.js';
import { FakeClock } from '../../src/platform/clock/clock.js';
import { OutboxRelay } from '../../src/platform/jobs/outbox-relay.js';
import { TransactionalOutbox } from '../../src/platform/jobs/transactional-outbox.js';
import type { AppConfigService } from '../../src/config/app-config.service.js';
import { purgeDatabase } from '../../scripts/database/purge-database.js';
import { createTestDatabase, type TestDatabase } from '../database/test-database.js';

describe('transactional platform jobs', () => {
  let testDatabase: TestDatabase;
  let unitOfWork: DatabaseUnitOfWork;
  let outbox: TransactionalOutbox;
  const clock = new FakeClock(new Date('2026-08-03T12:00:00.000Z'));

  beforeAll(async () => {
    testDatabase = await createTestDatabase();
    await testDatabase.migrateProduction();
    unitOfWork = new DatabaseUnitOfWork(testDatabase.database);
    outbox = new TransactionalOutbox(clock);
  });

  beforeEach(async () => purgeDatabase(testDatabase.pool, testDatabase.url));
  afterAll(async () => testDatabase.release());

  it('commits one outbox message and suppresses a duplicate key', async () => {
    await unitOfWork.transaction(async context => {
      expect(
        await outbox.enqueue(context, {
          idempotencyKey: 'echo:1',
          name: 'fixture.echo',
          payload: { value: 'first' },
        }),
      ).toBe(true);
      expect(
        await outbox.enqueue(context, {
          idempotencyKey: 'echo:1',
          name: 'fixture.echo',
          payload: { value: 'duplicate' },
        }),
      ).toBe(false);
    });

    expect(await testDatabase.database.select().from(outboxMessages)).toHaveLength(1);
  });

  it('dispatches nothing when the transaction rolls back', async () => {
    await expect(
      unitOfWork.transaction(async context => {
        await outbox.enqueue(context, {
          idempotencyKey: 'echo:rollback',
          name: 'fixture.echo',
          payload: { value: 'rollback' },
        });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    expect(await testDatabase.database.select().from(outboxMessages)).toEqual([]);
  });

  it('claims an outbox row once across concurrent relays', async () => {
    await unitOfWork.transaction(context =>
      outbox.enqueue(context, {
        idempotencyKey: 'echo:relay',
        name: 'fixture.echo',
        payload: { value: 'relay' },
      }),
    );
    let dispatchCount = 0;
    const dispatcher = {
      dispatch: () => {
        dispatchCount += 1;
        return Promise.resolve({ id: 'job-id' });
      },
    };
    const config = { outboxBatchSize: 10 } as AppConfigService;
    const first = new OutboxRelay(config, unitOfWork, clock, dispatcher);
    const second = new OutboxRelay(config, unitOfWork, clock, dispatcher);

    await Promise.all([first.runOnce(), second.runOnce()]);

    expect(dispatchCount).toBe(1);
    const [message] = await testDatabase.database
      .select()
      .from(outboxMessages)
      .where(eq(outboxMessages.idempotencyKey, 'echo:relay'));
    expect(message?.dispatchedAt?.toISOString()).toBe(clock.now().toISOString());
  });
});
