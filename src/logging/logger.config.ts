import { randomUUID } from 'node:crypto';
import { RequestMethod } from '@nestjs/common';
import { Params } from 'nestjs-pino';
import { AppConfigService } from '../config/app-config.service.js';
import { ENVIRONMENT_VARIABLES } from '../config/config.constants.js';
import { HTTP_HEADERS, HTTP_ROUTES, REQUEST_ID_CONTRACT } from '../http/http.constants.js';
import { PROCESS_ROLE, type ProcessRole } from '../platform/jobs/job.constants.js';

const requestIdPattern = new RegExp(REQUEST_ID_CONTRACT.pattern);

export function createLoggerOptions(
  config: AppConfigService,
  processRole: ProcessRole = PROCESS_ROLE.api,
): Params {
  return {
    forRoutes: [{ path: HTTP_ROUTES.catchAll, method: RequestMethod.ALL }],
    pinoHttp: {
      base: { processRole },
      level: config.logLevel,
      transport: config.isDevelopment
        ? {
            target: 'pino-pretty',
            options: { colorize: true, singleLine: true },
          }
        : undefined,
      genReqId(request, response) {
        const providedId = request.headers[HTTP_HEADERS.requestId];
        const requestId =
          typeof providedId === 'string' && requestIdPattern.test(providedId)
            ? providedId
            : randomUUID();

        response.setHeader(HTTP_HEADERS.requestId, requestId);
        return requestId;
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers.set-cookie',
          'password',
          'token',
          'accessToken',
          'refreshToken',
          ENVIRONMENT_VARIABLES.databaseUrl,
          'REDIS_URL',
        ],
        censor: '[Redacted]',
      },
    },
  };
}
