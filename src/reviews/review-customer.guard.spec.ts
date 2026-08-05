import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ReviewCustomerGuard } from './review-customer.guard.js';

function context(role: 'user' | 'guide' | 'lead-guide' | 'admin'): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ principal: { role } }) }),
  } as unknown as ExecutionContext;
}

describe('ReviewCustomerGuard', () => {
  const guard = new ReviewCustomerGuard();

  it('allows customers', () => expect(guard.canActivate(context('user'))).toBe(true));

  it.each(['guide', 'lead-guide', 'admin'] as const)('rejects operator role %s', role => {
    expect(() => guard.canActivate(context(role))).toThrow(ForbiddenException);
  });
});
