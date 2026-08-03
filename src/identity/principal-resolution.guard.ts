import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { users } from '../database/schema/identity.js';
import type { AuthenticatedRequest } from './authentication.types.js';

@Injectable()
export class PrincipalResolutionGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;
    if (!userId) return true;
    const [user] = await this.database
      .select({ emailVerified: users.emailVerified, id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new UnauthorizedException('The authenticated user no longer exists.');
    request.principal = { emailVerified: user.emailVerified, role: user.role, userId: user.id };
    const sessionId = request.session?.id;
    const expiresAt = request.session?.expiresAt;
    if (sessionId && expiresAt) {
      request.resolvedSession = {
        expiresAt: expiresAt instanceof Date ? expiresAt : new Date(expiresAt),
        id: sessionId,
        principal: request.principal,
      };
    }
    return true;
  }
}
