export interface DomainErrorOptions {
  code: string;
  status: number;
  message: string;
  details?: unknown;
}

export class DomainError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(options: DomainErrorOptions) {
    super(options.message);
    this.name = DomainError.name;
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
  }
}
