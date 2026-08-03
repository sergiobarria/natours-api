import { randomUUID } from 'node:crypto';

export type Uuid = `${string}-${string}-${string}-${string}-${string}`;

export function newUuid(): Uuid {
  return randomUUID();
}
