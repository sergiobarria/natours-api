import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../identity/identity.decorators.js';
import type { AuthenticatedPrincipal } from '../identity/authentication.types.js';
import { PERMISSION } from '../identity/permissions.js';
import { SensitiveResponseInterceptor } from '../http/response/sensitive-response.interceptor.js';
import { RateLimitPolicy } from '../rate-limit/rate-limit.decorators.js';
import { RATE_LIMIT_POLICY } from '../rate-limit/rate-limit.constants.js';
import { AccountSecurityService } from './account-security.service.js';
import {
  ChangeEmailDto,
  ChangePasswordDto,
  ConfirmPasswordDto,
  UpdateProfileDto,
  UpdateRoleDto,
} from './users.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
@ApiTags('users')
@ApiBearerAuth()
@UseInterceptors(SensitiveResponseInterceptor)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly security: AccountSecurityService,
  ) {}

  @Get('me')
  me(@CurrentPrincipal() principal?: AuthenticatedPrincipal) {
    return this.users.find(required(principal).userId);
  }

  @Patch('me')
  @ApiBody({ type: UpdateProfileDto })
  @RateLimitPolicy(RATE_LIMIT_POLICY.account)
  updateMe(
    @CurrentPrincipal() principal: AuthenticatedPrincipal | undefined,
    @Body() body: UpdateProfileDto,
    @Req() request: Request,
  ) {
    return this.users.updateProfile(required(principal).userId, body.name, requestId(request));
  }

  @Post('me/change-password')
  @ApiBody({ type: ChangePasswordDto })
  @ApiNoContentResponse({ description: 'Password changed; rotated token is in set-auth-token.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimitPolicy(RATE_LIMIT_POLICY.account)
  async changePassword(
    @CurrentPrincipal() principal: AuthenticatedPrincipal | undefined,
    @Body() body: ChangePasswordDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const retainedSessionToken = await this.security.changePassword(
      required(principal).userId,
      request.headers,
      body.currentPassword,
      body.newPassword,
      requestId(request),
    );
    response.setHeader('set-auth-token', retainedSessionToken);
  }

  @Post('me/change-email')
  @ApiBody({ type: ChangeEmailDto })
  @ApiNoContentResponse({ description: 'Email verification queued when a change is required.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimitPolicy(RATE_LIMIT_POLICY.account)
  async changeEmail(
    @CurrentPrincipal() principal: AuthenticatedPrincipal | undefined,
    @Body() body: ChangeEmailDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.security.changeEmail(
      required(principal).userId,
      request.headers,
      body.currentPassword,
      body.newEmail,
      requestId(request),
    );
  }

  @Delete('me')
  @ApiBody({ type: ConfirmPasswordDto })
  @ApiNoContentResponse({ description: 'Account deleted.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimitPolicy(RATE_LIMIT_POLICY.account)
  async deleteMe(
    @CurrentPrincipal() principal: AuthenticatedPrincipal | undefined,
    @Body() body: ConfirmPasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    const current = required(principal);
    await this.security.verifyPassword(request.headers, body.currentPassword);
    await this.users.delete(current.userId, current.userId, false, requestId(request));
  }

  @Get()
  @ApiOkResponse({ description: 'Users visible to an administrator.' })
  @RequirePermissions(PERMISSION.usersViewAny)
  list() {
    return this.users.list();
  }

  @Get(':userId')
  @ApiParam({ format: 'uuid', name: 'userId' })
  @RequirePermissions(PERMISSION.usersView)
  find(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.users.find(userId);
  }

  @Patch(':userId/role')
  @ApiParam({ format: 'uuid', name: 'userId' })
  @ApiBody({ type: UpdateRoleDto })
  @RequirePermissions(PERMISSION.usersUpdateRole)
  @RateLimitPolicy(RATE_LIMIT_POLICY.account)
  changeRole(
    @CurrentPrincipal() principal: AuthenticatedPrincipal | undefined,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: UpdateRoleDto,
    @Req() request: Request,
  ) {
    return this.users.changeRole(required(principal).userId, userId, body.role, requestId(request));
  }

  @Delete(':userId')
  @ApiParam({ format: 'uuid', name: 'userId' })
  @RequirePermissions(PERMISSION.usersDelete)
  @RateLimitPolicy(RATE_LIMIT_POLICY.account)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentPrincipal() principal: AuthenticatedPrincipal | undefined,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.users.delete(required(principal).userId, userId, true, requestId(request));
  }
}

function required(principal?: AuthenticatedPrincipal): AuthenticatedPrincipal {
  if (!principal) throw new UnauthorizedException();
  return principal;
}

function requestId(request: Request): string | undefined {
  return typeof request.id === 'string' || typeof request.id === 'number'
    ? String(request.id)
    : undefined;
}
