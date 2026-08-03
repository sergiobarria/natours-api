import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVIRONMENT_VARIABLES } from './config.constants';
import { Environment } from './environment';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Environment, true>) {}

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

  get isDevelopment(): boolean {
    return this.environment === 'development';
  }

  get isProduction(): boolean {
    return this.environment === 'production';
  }
}
