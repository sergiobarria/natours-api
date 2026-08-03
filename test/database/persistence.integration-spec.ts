import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { TEST_DATABASE_WORKER_MARKER } from '../../scripts/database/database-script.constants.js';
import {
  DatabaseUnitOfWork,
  getTransactionDatabase,
} from '../../src/database/database-unit-of-work.js';
import type { TransactionContext } from '../../src/database/database-unit-of-work.js';
import { databaseObjectName } from '../../src/database/schema/names.js';
import { purgeDatabase } from '../../scripts/database/purge-database.js';
import { persistenceChildren, persistenceRecords } from './fixtures/schema.js';
import { createTestDatabase, TestDatabase } from './test-database.js';

const lockObservationDelayMs = 75;

describe('PostgreSQL persistence infrastructure', () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await createTestDatabase();
    await testDatabase.migrateProduction();
    await testDatabase.migrateFixtures();
  });

  beforeEach(async () => {
    await purgeDatabase(testDatabase.pool, testDatabase.url);
  });

  afterAll(async () => {
    await testDatabase.release();
  });

  it('migrates a fresh database and applies fixture upgrades in order', async () => {
    const productionHistory = await testDatabase.pool.query<{ count: string }>(
      'SELECT count(*) FROM drizzle.__drizzle_migrations',
    );
    const fixtureHistory = await testDatabase.pool.query<{ count: string }>(
      'SELECT count(*) FROM fixture_migrations.__drizzle_migrations',
    );
    const upgradedColumn = await testDatabase.pool.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'persistence_records'
        AND column_name = 'label'
    `);

    expect(productionHistory.rows[0]?.count).toBe('5');
    expect(fixtureHistory.rows[0]?.count).toBe('2');
    expect(upgradedColumn.rows).toEqual([{ column_name: 'label' }]);
  });

  it('upgrades a database from the SBC-11 production baseline', async () => {
    const upgradeDatabase = await createTestDatabase();
    try {
      await upgradeDatabase.migrateProductionBaseline();
      const before = await upgradeDatabase.pool.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'outbox_messages'
      `);
      expect(before.rows).toEqual([]);

      await upgradeDatabase.migrateProduction();
      const after = await upgradeDatabase.pool.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('accounts', 'audit_events', 'job_effects', 'outbox_messages', 'sessions', 'users', 'verifications')
        ORDER BY table_name
      `);
      expect(after.rows).toEqual([
        { table_name: 'accounts' },
        { table_name: 'audit_events' },
        { table_name: 'job_effects' },
        { table_name: 'outbox_messages' },
        { table_name: 'sessions' },
        { table_name: 'users' },
        { table_name: 'verifications' },
      ]);
    } finally {
      await upgradeDatabase.release();
    }
  });

  it('uses UUID v4, timezone-aware timestamps, integer money, and soft deletion', async () => {
    const [record] = await testDatabase.fixtureDatabase
      .insert(persistenceRecords)
      .values({ amountInCents: 49_700, externalKey: 'forest-hiker', sequence: 1 })
      .returning();

    expect(record?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(record?.createdAt).toBeInstanceOf(Date);
    expect(record?.createdAt.toISOString()).toMatch(/Z$/);
    expect(record?.amountInCents).toBe(49_700);
    expect(record?.deletedAt).toBeNull();

    const deletedAt = new Date();
    const [deleted] = await testDatabase.fixtureDatabase
      .update(persistenceRecords)
      .set({ deletedAt })
      .where(eq(persistenceRecords.id, record.id))
      .returning();
    expect(deleted?.deletedAt?.toISOString()).toBe(deletedAt.toISOString());
  });

  it('enforces money, unique, and foreign-key constraints with conventional names', async () => {
    const [record] = await testDatabase.fixtureDatabase
      .insert(persistenceRecords)
      .values({ amountInCents: 100, externalKey: 'constraint-record', sequence: 1 })
      .returning();

    await expect(
      testDatabase.fixtureDatabase.insert(persistenceRecords).values({
        amountInCents: -1,
        externalKey: 'negative-money',
        sequence: 2,
      }),
    ).rejects.toThrow();
    await expect(
      testDatabase.fixtureDatabase.insert(persistenceRecords).values({
        amountInCents: 200,
        externalKey: 'constraint-record',
        sequence: 3,
      }),
    ).rejects.toThrow();
    await expect(
      testDatabase.fixtureDatabase.insert(persistenceChildren).values({
        recordId: '00000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toThrow();

    await testDatabase.fixtureDatabase.insert(persistenceChildren).values({ recordId: record.id });

    const constraints = await testDatabase.pool.query<{ conname: string }>(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid IN ('persistence_records'::regclass, 'persistence_children'::regclass)
    `);
    const indexes = await testDatabase.pool.query<{ indexname: string }>(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'persistence_records'
    `);

    expect(constraints.rows.map(row => row.conname)).toEqual(
      expect.arrayContaining([
        databaseObjectName('persistence_records', 'amount_in_cents', 'check'),
        databaseObjectName('persistence_records', 'external_key', 'unique'),
        databaseObjectName('persistence_children', 'record_id', 'fk'),
      ]),
    );
    expect(indexes.rows.map(row => row.indexname)).toContain(
      databaseObjectName('persistence_records', 'created_at', 'idx'),
    );
  });

  it('rolls back every write when a unit-of-work transaction fails', async () => {
    const unitOfWork = new DatabaseUnitOfWork(testDatabase.database);
    const recordId = randomUUID();

    await expect(
      unitOfWork.transaction(async context => {
        const transaction = getTransactionDatabase(context);
        await transaction.execute(sql`
          INSERT INTO persistence_records (id, external_key, amount_in_cents, sequence)
          VALUES (${recordId}, 'rollback-record', 500, 1)
        `);
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    const result = await testDatabase.pool.query<{ count: string }>(
      "SELECT count(*) FROM persistence_records WHERE external_key = 'rollback-record'",
    );
    expect(result.rows[0]?.count).toBe('0');
  });

  it('invalidates a transaction context after the transaction completes', async () => {
    const unitOfWork = new DatabaseUnitOfWork(testDatabase.database);
    let completedContext: TransactionContext | undefined;

    await unitOfWork.transaction(context => {
      completedContext = context;
      return Promise.resolve();
    });

    const context = completedContext;
    expect(context).toBeDefined();
    if (context === undefined) {
      throw new Error('Expected the transaction callback to receive a context');
    }
    expect(() => getTransactionDatabase(context)).toThrow(
      'The transaction context is invalid or no longer available',
    );
  });

  it('supports transaction-scoped row locking without exposing Drizzle to controllers', async () => {
    const [record] = await testDatabase.fixtureDatabase
      .insert(persistenceRecords)
      .values({ amountInCents: 100, externalKey: 'locked-record', sequence: 1 })
      .returning();
    let releaseLock: (() => void) | undefined;
    let lockAcquired: (() => void) | undefined;
    const release = new Promise<void>(resolve => {
      releaseLock = resolve;
    });
    const acquired = new Promise<void>(resolve => {
      lockAcquired = resolve;
    });

    const firstTransaction = testDatabase.fixtureDatabase.transaction(async transaction => {
      await transaction
        .select()
        .from(persistenceRecords)
        .where(eq(persistenceRecords.id, record.id))
        .for('update');
      lockAcquired?.();
      await release;
    });
    await acquired;

    let secondTransactionCompleted = false;
    const secondTransaction = testDatabase.fixtureDatabase
      .transaction(async transaction => {
        await transaction
          .update(persistenceRecords)
          .set({ sequence: 2 })
          .where(eq(persistenceRecords.id, record.id));
      })
      .then(() => {
        secondTransactionCompleted = true;
      });

    await delay(lockObservationDelayMs);
    expect(secondTransactionCompleted).toBe(false);
    releaseLock?.();
    await firstTransaction;
    await secondTransaction;
    expect(secondTransactionCompleted).toBe(true);
  });

  it('purges application data while retaining both migration histories', async () => {
    await testDatabase.fixtureDatabase.insert(persistenceRecords).values({
      amountInCents: 100,
      externalKey: 'purge-record',
      sequence: 1,
    });

    const purgedTables = await purgeDatabase(testDatabase.pool, testDatabase.url);
    const records = await testDatabase.pool.query<{ count: string }>(
      'SELECT count(*) FROM persistence_records',
    );
    const migrationSchemas = await testDatabase.pool.query<{ schema_name: string }>(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name IN ('drizzle', 'fixture_migrations')
      ORDER BY schema_name
    `);

    expect(purgedTables).toBe(8);
    expect(records.rows[0]?.count).toBe('0');
    expect(migrationSchemas.rows.map(row => row.schema_name)).toEqual([
      'drizzle',
      'fixture_migrations',
    ]);
    expect(new URL(testDatabase.url).pathname).toContain(TEST_DATABASE_WORKER_MARKER);
  });
});
