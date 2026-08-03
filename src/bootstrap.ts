import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import helmet from 'helmet';
import { AppConfigService } from './config/app-config.service.js';
import { APP_ENVIRONMENT } from './config/config.constants.js';
import { Environment } from './config/environment.js';
import { ApiExceptionFilter } from './http/errors/api-exception.filter.js';
import { createValidationError } from './http/errors/validation-error.factory.js';
import { API_CONTRACT, HTTP_ROUTES } from './http/http.constants.js';
import { ResponseEnvelopeInterceptor } from './http/response/response-envelope.interceptor.js';
import { createOpenApiDocument, registerOpenApiDocumentation } from './openapi/openapi.js';

export const API_PREFIX = HTTP_ROUTES.apiPrefix;
export const API_VERSION = API_CONTRACT.version;

export interface ApplicationConfigurationOptions {
  registerDocumentation?: boolean;
}

export async function configureApplication(
  app: INestApplication,
  config: AppConfigService,
  options: ApplicationConfigurationOptions = {},
): Promise<void> {
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [HTTP_ROUTES.health, HTTP_ROUTES.ready],
  });

  const express = app.getHttpAdapter().getInstance() as {
    set(name: string, value: unknown): void;
  };
  express.set('trust proxy', config.trustedProxyCidrs);

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_VERSION,
  });

  app.use(
    helmet({
      contentSecurityPolicy: config.isProduction ? undefined : false,
    }),
  );

  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: errors => createValidationError(errors),
    }),
  );
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new ApiExceptionFilter());

  app.enableShutdownHooks();

  if (options.registerDocumentation !== false && isApiDocsEnabled(config.environment)) {
    await registerOpenApiDocumentation(app, createOpenApiDocument(app));
  }
}

export function isApiDocsEnabled(environment: Environment['NODE_ENV']): boolean {
  return environment !== APP_ENVIRONMENT.production;
}
