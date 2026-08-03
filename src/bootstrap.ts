import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppConfigService } from './config/app-config.service';
import { Environment } from './config/environment';

export const API_PREFIX = 'api';
export const API_VERSION = '1';

export async function configureApplication(
  app: INestApplication,
  config: AppConfigService,
): Promise<void> {
  app.setGlobalPrefix(API_PREFIX, {
    exclude: ['health'],
  });

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
    }),
  );

  app.enableShutdownHooks();

  if (isApiDocsEnabled(config.environment)) {
    const { apiReference } = await import('@scalar/nestjs-api-reference');
    const openApiConfig = new DocumentBuilder()
      .setTitle('Natours API')
      .setDescription('HTTP API for the Natours application')
      .setVersion(API_VERSION)
      .build();
    const document = SwaggerModule.createDocument(app, openApiConfig, {
      ignoreGlobalPrefix: false,
    });

    SwaggerModule.setup('docs', app, document, {
      ui: false,
      jsonDocumentUrl: 'docs-json',
    });

    app.use(
      '/docs',
      apiReference({
        content: document,
        pageTitle: 'Natours API Reference',
      }),
    );
  }
}

export function isApiDocsEnabled(environment: Environment['NODE_ENV']): boolean {
  return environment !== 'production';
}
