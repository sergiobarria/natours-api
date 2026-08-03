import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './authentication.types.js';
import { OWNERSHIP_METADATA } from './identity.decorators.js';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const parameter = this.reflector.getAllAndOverride<string>(OWNERSHIP_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!parameter) return true;
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { params?: Record<string, string> }>();
    if (!request.principal) throw new UnauthorizedException();
    const targetId = request.params?.[parameter]?.toLowerCase();
    if (targetId !== request.principal.userId.toLowerCase()) throw new ForbiddenException();
    return true;
  }
}
