import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PermissionGuard } from './permission.guard.js';
import { PrincipalResolutionGuard } from './principal-resolution.guard.js';

@Module({
  providers: [
    { provide: APP_GUARD, useClass: PrincipalResolutionGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class IdentityApplicationModule {}
