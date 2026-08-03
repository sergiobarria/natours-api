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

  const document = SwaggerModule.createDocument(app, configuration, {
    ignoreGlobalPrefix: false,
  });
  document.components ??= {};
  document.components.securitySchemes ??= {};
  document.components.securitySchemes.bearerAuth = { scheme: 'bearer', type: 'http' };
  Object.assign(document.paths, nativeAuthPaths());
  return document;
}

function nativeAuthPaths(): OpenAPIObject['paths'] {
  const nativeResponse = {
    '200': { description: 'Native Better Auth response; not wrapped in the domain envelope.' },
    '400': { description: 'Native Better Auth validation error.' },
    '401': { description: 'Native Better Auth authentication error.' },
  };
  return {
    '/api/v1/auth/sign-up/email': {
      post: {
        operationId: 'betterAuthSignUpEmail',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'name', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  name: { type: 'string' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: nativeResponse,
        summary: 'Register with email and password',
        tags: ['native-authentication'],
      },
    },
    '/api/v1/auth/sign-in/email': {
      post: {
        operationId: 'betterAuthSignInEmail',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          ...nativeResponse,
          '200': {
            description:
              'Native response. Bearer session token is returned in the set-auth-token header.',
            headers: {
              'set-auth-token': {
                schema: { type: 'string' },
                description: 'Bearer session token.',
              },
            },
          },
        },
        summary: 'Sign in with email and password',
        tags: ['native-authentication'],
      },
    },
    '/api/v1/auth/get-session': {
      get: {
        operationId: 'betterAuthGetSession',
        responses: nativeResponse,
        security: [{ bearerAuth: [] }],
        summary: 'Resolve the current session',
        tags: ['native-authentication'],
      },
    },
    '/api/v1/auth/sign-out': {
      post: {
        operationId: 'betterAuthSignOut',
        responses: nativeResponse,
        security: [{ bearerAuth: [] }],
        summary: 'Revoke the current session',
        tags: ['native-authentication'],
      },
    },
    '/api/v1/auth/send-verification-email': {
      post: {
        operationId: 'betterAuthSendVerificationEmail',
        responses: nativeResponse,
        summary: 'Request email verification',
        tags: ['native-authentication'],
      },
    },
    '/api/v1/auth/verify-email': {
      get: {
        operationId: 'betterAuthVerifyEmail',
        responses: {
          '302': { description: 'Verification result redirect.' },
          '400': nativeResponse['400'],
        },
        summary: 'Verify an email token',
        tags: ['native-authentication'],
      },
    },
    '/api/v1/auth/request-password-reset': {
      post: {
        operationId: 'betterAuthRequestPasswordReset',
        responses: nativeResponse,
        summary: 'Request an enumeration-safe password reset',
        tags: ['native-authentication'],
      },
    },
    '/api/v1/auth/reset-password': {
      post: {
        operationId: 'betterAuthResetPassword',
        responses: nativeResponse,
        summary: 'Reset a password and revoke all sessions',
        tags: ['native-authentication'],
      },
    },
  };
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
