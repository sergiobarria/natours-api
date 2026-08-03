export const JOB_QUEUE = Symbol('JOB_QUEUE');

export const PROCESS_ROLE = {
  api: 'api',
  worker: 'worker',
} as const;

export type ProcessRole = (typeof PROCESS_ROLE)[keyof typeof PROCESS_ROLE];
