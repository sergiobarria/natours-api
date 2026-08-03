import { randomUUID } from 'node:crypto';
import { AUDIT_ACTION, SYSTEM_ACTOR } from '../../src/audit/audit.constants.js';
import { DrizzleAuditRecorder } from '../../src/audit/drizzle-audit-recorder.js';
import { DatabaseUnitOfWork } from '../../src/database/database-unit-of-work.js';
import { auditEvents } from '../../src/database/schema/operations.js';
import { createTestDatabase, type TestDatabase } from '../database/test-database.js';

describe('immutable audit persistence', () => {
  let testDatabase: TestDatabase;
  let unitOfWork: DatabaseUnitOfWork;
  const recorder = new DrizzleAuditRecorder();

  beforeAll(async () => {
    testDatabase = await createTestDatabase();
    await testDatabase.migrateProduction();
    unitOfWork = new DatabaseUnitOfWork(testDatabase.database);
  });

  afterAll(async () => testDatabase.release());

  it('records exactly once with its transaction and rejects mutations', async () => {
    const targetId = randomUUID();
    const record = () =>
      unitOfWork.transaction(context =>
        recorder.record(context, {
          action: AUDIT_ACTION.accountSecurityChanged,
          actor: { type: 'system', name: SYSTEM_ACTOR.worker },
          after: { changed: true, password: 'never-store' },
          eventKey: 'audit:fixture:once',
          targetId,
          targetType: 'user',
        }),
      );
    await expect(record()).resolves.toBe(true);
    await expect(record()).resolves.toBe(false);
    const rows = await testDatabase.database.select().from(auditEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.after).toEqual({ changed: true });
    await expect(
      testDatabase.pool.query('update audit_events set action = action'),
    ).rejects.toThrow('append-only');
    await expect(testDatabase.pool.query('delete from audit_events')).rejects.toThrow(
      'append-only',
    );
    await expect(testDatabase.pool.query('truncate audit_events')).rejects.toThrow('append-only');
  });

  it('rolls audit insertion back with the mutation', async () => {
    await expect(
      unitOfWork.transaction(async context => {
        await recorder.record(context, {
          action: AUDIT_ACTION.profileChanged,
          actor: { type: 'user', userId: randomUUID() },
          eventKey: 'audit:fixture:rollback',
          targetId: randomUUID(),
          targetType: 'user',
        });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(
      (
        await testDatabase.pool.query(
          "select 1 from audit_events where event_key = 'audit:fixture:rollback'",
        )
      ).rows,
    ).toHaveLength(0);
  });
});
