export interface DispatchJob<T = unknown> {
  idempotencyKey: string;
  name: string;
  payload: T;
}

export interface OutboxMessage<T = unknown> extends DispatchJob<T> {
  availableAt?: Date;
}
