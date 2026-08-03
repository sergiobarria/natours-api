import { createHash } from 'node:crypto';

export function stableJobId(name: string, idempotencyKey: string): string {
  const digest = createHash('sha256')
    .update(name)
    .update('\0')
    .update(idempotencyKey)
    .digest('hex');
  return `job-${digest}`;
}
