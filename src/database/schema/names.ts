import { createHash } from 'node:crypto';

const postgresIdentifierLimit = 63;
const invalidIdentifierCharacters = /[^a-z0-9_]+/g;

export type DatabaseObjectSuffix = 'check' | 'fk' | 'idx' | 'pk' | 'unique';

export function databaseObjectName(
  table: string,
  columns: string | readonly string[],
  suffix: DatabaseObjectSuffix,
): string {
  const columnNames = typeof columns === 'string' ? [columns] : [...columns];
  const parts = [table, ...columnNames, suffix];
  const normalized = parts
    .join('_')
    .trim()
    .toLowerCase()
    .replace(invalidIdentifierCharacters, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  if (normalized.length <= postgresIdentifierLimit) {
    return normalized;
  }

  const digest = createHash('sha256').update(normalized).digest('hex').slice(0, 8);
  return `${normalized.slice(0, postgresIdentifierLimit - digest.length - 1)}_${digest}`;
}
