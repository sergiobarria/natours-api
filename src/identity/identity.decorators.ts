import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type {
  AuthenticatedPrincipal,
  AuthenticatedSession,
  AuthenticatedRequest,
} from './authentication.types.js';
import type { Permission } from './permissions.js';

export const PERMISSIONS_METADATA = Symbol('PERMISSIONS_METADATA');

export const PublicRoute = AllowAnonymous;
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_METADATA, permissions);

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().principal,
);

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedSession | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().resolvedSession,
);
