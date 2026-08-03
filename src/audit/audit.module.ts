import { Global, Module } from '@nestjs/common';
import { AUDIT_RECORDER } from './audit.constants.js';
import { DrizzleAuditRecorder } from './drizzle-audit-recorder.js';

@Global()
@Module({
  providers: [DrizzleAuditRecorder, { provide: AUDIT_RECORDER, useExisting: DrizzleAuditRecorder }],
  exports: [AUDIT_RECORDER],
})
export class AuditModule {}
