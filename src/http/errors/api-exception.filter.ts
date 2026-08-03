import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { HTTP_HEADERS } from '../http.constants.js';
import { DomainError } from './domain.error.js';
import { ERROR_CODES, ERROR_MESSAGES } from './error.constants.js';
import type { ErrorResponse } from './error.types.js';

interface MappedException {
  code: string;
  status: number;
  message: string;
  details?: unknown;
  unexpected: boolean;
}

const internalServerErrorStatus: number = HttpStatus.INTERNAL_SERVER_ERROR;

const httpErrorCodes: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: ERROR_CODES.badRequest,
  [HttpStatus.UNAUTHORIZED]: ERROR_CODES.unauthorized,
  [HttpStatus.FORBIDDEN]: ERROR_CODES.forbidden,
  [HttpStatus.NOT_FOUND]: ERROR_CODES.notFound,
  [HttpStatus.METHOD_NOT_ALLOWED]: ERROR_CODES.methodNotAllowed,
  [HttpStatus.CONFLICT]: ERROR_CODES.conflict,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ERROR_CODES.unprocessableEntity,
  [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.tooManyRequests,
};

function httpExceptionMessage(exception: HttpException): string {
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return response;
  }

  return 'message' in response && typeof response.message === 'string'
    ? response.message
    : exception.message;
}

export function mapException(exception: unknown): MappedException {
  if (exception instanceof DomainError) {
    return {
      code: exception.code,
      status: exception.status,
      message: exception.message,
      details: exception.details,
      unexpected: false,
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();

    if (status >= internalServerErrorStatus) {
      return {
        code: ERROR_CODES.internalServerError,
        status: internalServerErrorStatus,
        message: ERROR_MESSAGES.internalServerError,
        unexpected: true,
      };
    }

    return {
      code: httpErrorCodes[status] ?? `HTTP_${status}`,
      status,
      message: httpExceptionMessage(exception),
      unexpected: false,
    };
  }

  return {
    code: ERROR_CODES.internalServerError,
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: ERROR_MESSAGES.internalServerError,
    unexpected: true,
  };
}

function resolveRequestId(request: Request, response: Response): string {
  const responseRequestId = response.getHeader(HTTP_HEADERS.requestId);
  const requestId = request.id ?? responseRequestId;
  return typeof requestId === 'string' || typeof requestId === 'number'
    ? String(requestId)
    : randomUUID();
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const requestId = resolveRequestId(request, response);

    response.setHeader(HTTP_HEADERS.requestId, requestId);

    const mapped = mapException(exception);

    if (mapped.unexpected) {
      this.logUnexpected(exception, request, requestId);
    }

    const body: ErrorResponse = {
      error: {
        code: mapped.code,
        message: mapped.message,
        requestId,
        ...(mapped.details === undefined ? {} : { details: mapped.details }),
      },
    };
    response.status(mapped.status).json(body);
  }

  private logUnexpected(exception: unknown, request: Request, requestId: string): void {
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(
      `Unexpected error for ${request.method} ${request.path} [requestId=${requestId}]`,
      stack,
    );
  }
}
