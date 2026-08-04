export const JOB_QUEUE = Symbol('JOB_QUEUE');
export const BOOKING_EXPIRE_JOB = 'bookings.expire-holds';
export const BOOKING_CHECKOUT_RECOVERY_JOB = 'bookings.recover-checkouts';
export const BOOKING_REFUND_RECONCILIATION_JOB = 'bookings.reconcile-refunds';

export const PROCESS_ROLE = {
  api: 'api',
  worker: 'worker',
  scheduler: 'scheduler',
} as const;

export type ProcessRole = (typeof PROCESS_ROLE)[keyof typeof PROCESS_ROLE];
