import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { APIError } from 'better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import { randomUUID } from 'node:crypto';
import { DrizzleAuditRecorder } from '../audit/drizzle-audit-recorder.js';
import { DatabaseUnitOfWork } from '../database/database-unit-of-work.js';

@Injectable()
export class AccountSecurityService {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(DatabaseUnitOfWork) private readonly unitOfWork: DatabaseUnitOfWork,
    private readonly audit: DrizzleAuditRecorder,
  ) {}

  async changePassword(
    userId: string,
    headers: IncomingHttpHeaders,
    currentPassword: string,
    newPassword: string,
    requestId?: string,
  ): Promise<string> {
    const result = await this.callAuth(() =>
      this.auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers: fromNodeHeaders(headers),
      }),
    );
    if (!result.token) {
      throw new Error('Better Auth did not rotate the retained session token.');
    }
    await this.record(userId, { changed: true, sessionsRevoked: 'others' }, requestId);
    return result.token;
  }

  async changeEmail(
    userId: string,
    headers: IncomingHttpHeaders,
    currentPassword: string,
    newEmail: string,
    requestId?: string,
  ): Promise<void> {
    const authHeaders = fromNodeHeaders(headers);
    await this.callAuth(() =>
      this.auth.api.verifyPassword({ body: { password: currentPassword }, headers: authHeaders }),
    );
    await this.callAuth(() =>
      this.auth.api.changeEmail({
        body: { callbackURL: '/account', newEmail: newEmail.trim().toLowerCase() },
        headers: authHeaders,
      }),
    );
    await this.record(userId, { changed: true }, requestId);
  }

  async verifyPassword(headers: IncomingHttpHeaders, password: string): Promise<void> {
    await this.callAuth(() =>
      this.auth.api.verifyPassword({ body: { password }, headers: fromNodeHeaders(headers) }),
    );
  }

  private async callAuth<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof APIError) {
        throw new BadRequestException('The account security change could not be completed.');
      }
      throw error;
    }
  }

  private record(
    userId: string,
    after: Record<string, unknown>,
    requestId?: string,
  ): Promise<void> {
    return this.unitOfWork.transaction(transaction =>
      this.audit
        .record(transaction, {
          action: 'account.security_changed',
          actor: { type: 'user', userId },
          after,
          eventKey: randomUUID(),
          requestId,
          targetId: userId,
          targetType: 'user',
        })
        .then(() => undefined),
    );
  }
}
