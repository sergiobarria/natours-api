import { AUDIT_ACTION } from './audit.constants.js';
import { sanitizeAuditMetadata } from './audit-sanitizer.js';

describe('sanitizeAuditMetadata', () => {
  it('applies action allowlists and recursively removes sensitive values', () => {
    expect(
      sanitizeAuditMetadata(AUDIT_ACTION.accountSecurityChanged, {
        changed: true,
        email: 'unnecessary@example.com',
        nested: { token: 'secret' },
        password: 'secret',
        sessionsRevoked: 3,
      }),
    ).toEqual({ changed: true, sessionsRevoked: 3 });
  });
});
