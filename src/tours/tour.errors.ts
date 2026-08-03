import { DomainError } from '../http/errors/domain.error.js';

export class TourPolicyError extends DomainError {
  constructor(code: string, message: string) {
    super({ code, message, status: 422 });
  }
}
