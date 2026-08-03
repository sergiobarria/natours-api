import type { TransactionContext } from '../database/database-unit-of-work.js';
import type { AuditAction } from './audit.constants.js';

export type AuditActor = { type: 'user'; userId: string } | { type: 'system'; name: string };

export interface RecordAuditEvent {
  action: AuditAction;
  actor: AuditActor;
  after?: Record<string, unknown>;
  before?: Record<string, unknown>;
  eventKey: string;
  requestId?: string;
  targetId: string;
  targetType: string;
}

export interface AuditRecorder {
  record(context: TransactionContext, event: RecordAuditEvent): Promise<boolean>;
}
