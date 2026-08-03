import type { ApplicationRole } from '../database/schema/identity.js';

export interface AuthenticatedPrincipal {
  emailVerified: boolean;
  role: ApplicationRole;
  userId: string;
}

export interface AuthenticatedSession {
  expiresAt: Date;
  id: string;
  principal: AuthenticatedPrincipal;
}

export interface AuthenticatedRequest {
  principal?: AuthenticatedPrincipal;
  resolvedSession?: AuthenticatedSession;
  session?: { expiresAt?: Date | string; id?: string };
  user?: { emailVerified?: boolean; id?: string };
}
