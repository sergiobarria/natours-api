export const JOB_DISPATCHER = Symbol('JOB_DISPATCHER');
export const OUTBOX = Symbol('OUTBOX');
export const JOB_QUEUE = Symbol('JOB_QUEUE');

export const PROCESS_ROLE = {
  api: 'api',
  scheduler: 'scheduler',
  worker: 'worker',
} as const;

export type ProcessRole = (typeof PROCESS_ROLE)[keyof typeof PROCESS_ROLE];
