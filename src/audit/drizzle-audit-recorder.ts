import { Injectable } from '@nestjs/common';
import { getTransactionDatabase } from '../database/database-unit-of-work.js';
import { auditEvents } from '../database/schema/operations.js';
import { sanitizeAuditMetadata } from './audit-sanitizer.js';
import type { AuditRecorder, RecordAuditEvent } from './audit.types.js';

@Injectable()
export class DrizzleAuditRecorder implements AuditRecorder {
  async record(
    context: Parameters<AuditRecorder['record']>[0],
    event: RecordAuditEvent,
  ): Promise<boolean> {
    const inserted = await getTransactionDatabase(context)
      .insert(auditEvents)
      .values({
        action: event.action,
        actorId: event.actor.type === 'user' ? event.actor.userId : null,
        actorType: event.actor.type,
        after: sanitizeAuditMetadata(event.action, event.after),
        before: sanitizeAuditMetadata(event.action, event.before),
        eventKey: event.eventKey,
        requestId: event.requestId,
        systemActorName: event.actor.type === 'system' ? event.actor.name : null,
        targetId: event.targetId,
        targetType: event.targetType,
      })
      .onConflictDoNothing()
      .returning({ id: auditEvents.id });
    return inserted.length === 1;
  }
}
