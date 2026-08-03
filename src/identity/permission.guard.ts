import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './authentication.types.js';
import { PERMISSIONS_METADATA } from './identity.decorators.js';
import { roleHasPermissions, type Permission } from './permissions.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const principal = context.switchToHttp().getRequest<AuthenticatedRequest>().principal;
    if (!principal) throw new UnauthorizedException();
    if (!roleHasPermissions(principal.role, required)) throw new ForbiddenException();
    return true;
  }
}
