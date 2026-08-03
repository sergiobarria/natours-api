import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppConfigService } from '../config/app-config.service.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { AuthEmailOutbox } from './auth-email-outbox.js';
import { createBetterAuth } from './better-auth.factory.js';
import { IdentityEmailModule } from './identity-email.module.js';
import { IdentityApplicationModule } from './identity-application.module.js';

@Module({
  imports: [
    IdentityEmailModule,
    AuthModule.forRootAsync({
      imports: [IdentityEmailModule],
      inject: [AppConfigService, DATABASE, AuthEmailOutbox],
      useFactory: (config: AppConfigService, database: Database, outbox: AuthEmailOutbox) => ({
        auth: createBetterAuth(config, database, outbox),
        bodyParser: {
          json: { limit: '1mb' },
          rawBody: true,
          urlencoded: { extended: true, limit: '1mb' },
        },
      }),
    }),
    // Application guards must run after the integration's global AuthGuard has
    // attached the vendor session to the request.
    IdentityApplicationModule,
  ],
  exports: [AuthModule],
})
export class IdentityModule {}
