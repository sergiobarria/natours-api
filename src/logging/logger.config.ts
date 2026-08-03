import { randomUUID } from 'node:crypto';
import { Params } from 'nestjs-pino';
import { AppConfigService } from '../config/app-config.service';

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

export function createLoggerOptions(config: AppConfigService): Params {
  return {
    pinoHttp: {
      level: config.logLevel,
      transport: config.isDevelopment
        ? {
            target: 'pino-pretty',
            options: { colorize: true, singleLine: true },
          }
        : undefined,
      genReqId(request, response) {
        const providedId = request.headers['x-request-id'];
        const requestId =
          typeof providedId === 'string' && requestIdPattern.test(providedId)
            ? providedId
            : randomUUID();

        response.setHeader('x-request-id', requestId);
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
          'DATABASE_URL',
          'REDIS_URL',
        ],
        censor: '[Redacted]',
      },
    },
  };
}
