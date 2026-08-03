import type { AuditAction } from './audit.constants.js';
import { isSensitiveFieldName } from '../security/sensitive-data.js';

const safeSecurityMarkers = new Set(['changed', 'sessionsRevoked']);

const allowedFields: Record<AuditAction, ReadonlySet<string>> = {
  'user.administered': new Set(['active', 'role']),
  'user.role_changed': new Set(['role']),
  'account.security_changed': new Set(['changed', 'sessionsRevoked']),
  'user.profile_changed': new Set(['changed']),
  'tour.changed': new Set(['status', 'slug']),
  'tour.guide_team_replaced': new Set(['guideIds']),
  'tour.departure_changed': new Set(['status', 'startAt', 'availableSpots', 'isActive']),
  'tour.media_changed': new Set(['status', 'position', 'count']),
};

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => safeSecurityMarkers.has(key) || !isSensitiveFieldName(key))
      .map(([key, child]) => [key, redact(child)]),
  );
}

export function sanitizeAuditMetadata(
  action: AuditAction,
  metadata?: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!metadata) return null;
  const allowed = allowedFields[action];
  return redact(
    Object.fromEntries(Object.entries(metadata).filter(([key]) => allowed.has(key))),
  ) as Record<string, unknown>;
}
