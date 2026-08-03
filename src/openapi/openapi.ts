import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { API_CONTRACT, HTTP_ROUTES } from '../http/http.constants.js';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const configuration = new DocumentBuilder()
    .setTitle(API_CONTRACT.name)
    .setDescription(API_CONTRACT.description)
    .setVersion(API_CONTRACT.version)
    .build();

  return SwaggerModule.createDocument(app, configuration, {
    ignoreGlobalPrefix: false,
  });
}

export async function registerOpenApiDocumentation(
  app: INestApplication,
  document: OpenAPIObject,
): Promise<void> {
  const { apiReference } = await import('@scalar/nestjs-api-reference');

  SwaggerModule.setup(HTTP_ROUTES.docs, app, document, {
    ui: false,
    jsonDocumentUrl: HTTP_ROUTES.docsJson,
  });

  app.use(
    `/${HTTP_ROUTES.docs}`,
    apiReference({
      content: document,
      pageTitle: API_CONTRACT.referenceTitle,
    }),
  );
}
