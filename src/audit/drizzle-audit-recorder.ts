import { Injectable } from '@nestjs/common';
import { auditEvents } from '../database/schema/operations.js';
import { sanitizeAuditMetadata } from './audit-sanitizer.js';
import type { RecordAuditEvent } from './audit.types.js';
import type { DatabaseTransaction } from '../database/database.types.js';

@Injectable()
export class DrizzleAuditRecorder {
  async record(transaction: DatabaseTransaction, event: RecordAuditEvent): Promise<boolean> {
    const inserted = await transaction
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
