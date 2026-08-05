import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../identity/authentication.types.js';

@Injectable()
export class ReviewCustomerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const principal = context.switchToHttp().getRequest<AuthenticatedRequest>().principal;
    if (principal?.role !== 'user') {
      throw new ForbiddenException('Only customers may manage reviews.');
    }
    return true;
  }
}
