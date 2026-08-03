import { ExecutionContext, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerStorage,
  getOptionsToken,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import { RATE_LIMIT_BYPASS_METADATA } from './rate-limit.constants.js';

@Injectable()
export class ApplicationThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(getOptionsToken()) options: ThrottlerModuleOptions,
    @Inject(ThrottlerStorage) storage: ThrottlerStorage,
    @Inject(Reflector) reflector: Reflector,
  ) {
    super(options, storage, reflector);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context);
    } catch (error) {
      if (error instanceof ServiceUnavailableException || this.isThrottleException(error)) {
        throw error;
      }
      throw new ServiceUnavailableException('Rate limiting is temporarily unavailable.');
    }
  }

  protected override shouldSkip(context: ExecutionContext): Promise<boolean> {
    return Promise.resolve(
      this.reflector.getAllAndOverride<boolean>(RATE_LIMIT_BYPASS_METADATA, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false,
    );
  }

  protected override getTracker(request: Record<string, unknown>): Promise<string> {
    const user = request.user as { id?: unknown } | undefined;
    const ip = typeof request.ip === 'string' ? request.ip : '';
    const identity = typeof user?.id === 'string' ? `user:${user.id}` : `guest:${ip}`;
    return Promise.resolve(createHash('sha256').update(identity).digest('hex'));
  }

  private isThrottleException(error: unknown): boolean {
    return error instanceof Error && error.name === 'ThrottlerException';
  }
}
