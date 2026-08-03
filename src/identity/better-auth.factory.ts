import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { AppConfigService } from '../config/app-config.service.js';
import type { Database } from '../database/database.types.js';
import { accounts, sessions, users, verifications } from '../database/schema/identity.js';
import { AuthEmailOutbox } from './auth-email-outbox.js';
import { AUTH_EMAIL_TYPE } from './identity.constants.js';

export function createBetterAuth(
  config: AppConfigService,
  database: Database,
  emailOutbox: AuthEmailOutbox,
) {
  return betterAuth({
    advanced: { database: { generateId: 'uuid' } },
    basePath: '/api/v1/auth',
    baseURL: config.betterAuthUrl,
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema: { account: accounts, session: sessions, user: users, verification: verifications },
    }),
    emailAndPassword: {
      enabled: true,
      maxPasswordLength: config.betterAuthMaxPasswordLength,
      minPasswordLength: config.betterAuthMinPasswordLength,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: config.betterAuthPasswordResetExpiresInSeconds,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) =>
        emailOutbox.enqueue({
          expiresInSeconds: config.betterAuthPasswordResetExpiresInSeconds,
          recipient: user.email,
          type: AUTH_EMAIL_TYPE.passwordReset,
          url,
        }),
    },
    emailVerification: {
      autoSignInAfterVerification: false,
      expiresIn: config.betterAuthVerificationExpiresInSeconds,
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) =>
        emailOutbox.enqueue({
          expiresInSeconds: config.betterAuthVerificationExpiresInSeconds,
          recipient: user.email,
          type: AUTH_EMAIL_TYPE.verification,
          url,
        }),
    },
    plugins: [bearer()],
    logger: { disabled: true },
    secret: config.betterAuthSecret,
    trustedOrigins: config.betterAuthTrustedOrigins,
    user: {
      additionalFields: {
        role: {
          defaultValue: 'user',
          input: false,
          required: true,
          returned: false,
          type: ['user', 'guide', 'lead-guide', 'admin'],
        },
      },
      changeEmail: { enabled: true },
    },
    session: {
      expiresIn: config.betterAuthSessionExpiresInSeconds,
      updateAge: config.betterAuthSessionUpdateAgeSeconds,
    },
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
