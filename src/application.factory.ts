import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApplication } from './bootstrap.js';
import { AppConfigService } from './config/app-config.service.js';

export interface ApplicationFactoryOptions {
  registerDocumentation?: boolean;
}

export async function createApplication(
  options: ApplicationFactoryOptions = {},
): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bodyParser: false, bufferLogs: true });
  const config = app.get(AppConfigService);

  app.useLogger(app.get(Logger));
  await configureApplication(app, config, options);
  return app;
}
