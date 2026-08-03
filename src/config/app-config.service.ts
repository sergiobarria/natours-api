import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_ENVIRONMENT, ENVIRONMENT_VARIABLES } from './config.constants.js';
import { Environment } from './environment.js';

@Injectable()
export class AppConfigService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService<Environment, true>) {}

  get environment(): Environment['NODE_ENV'] {
    return this.config.get(ENVIRONMENT_VARIABLES.nodeEnv, { infer: true });
  }

  get host(): string {
    return this.config.get(ENVIRONMENT_VARIABLES.host, { infer: true });
  }

  get port(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.port, { infer: true });
  }

  get logLevel(): Environment['LOG_LEVEL'] {
    return this.config.get(ENVIRONMENT_VARIABLES.logLevel, { infer: true });
  }

  get corsOrigins(): string[] {
    return this.config.get(ENVIRONMENT_VARIABLES.corsOrigins, { infer: true });
  }

  get databaseUrl(): string {
    return this.config.get(ENVIRONMENT_VARIABLES.databaseUrl, { infer: true });
  }

  get databasePoolMax(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.databasePoolMax, { infer: true });
  }

  get databasePoolIdleTimeoutMs(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.databasePoolIdleTimeoutMs, { infer: true });
  }

  get databasePoolConnectionTimeoutMs(): number {
    return this.config.get(ENVIRONMENT_VARIABLES.databasePoolConnectionTimeoutMs, {
      infer: true,
    });
  }

  get isDevelopment(): boolean {
    return this.environment === APP_ENVIRONMENT.development;
  }

  get isProduction(): boolean {
    return this.environment === APP_ENVIRONMENT.production;
  }
}
