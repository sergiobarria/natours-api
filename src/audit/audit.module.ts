import { Global, Module } from '@nestjs/common';
import { DrizzleAuditRecorder } from './drizzle-audit-recorder.js';

@Global()
@Module({
  providers: [DrizzleAuditRecorder],
  exports: [DrizzleAuditRecorder],
})
export class AuditModule {}
