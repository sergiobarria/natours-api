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
import { ERROR_MESSAGES } from '../errors/error.constants.js';
import { HTTP_HEADERS } from '../http.constants.js';

const internalServerErrorStatus: number = HttpStatus.INTERNAL_SERVER_ERROR;

function resolveRequestId(request: Request, response: Response): string {
  const responseRequestId = response.getHeader(HTTP_HEADERS.requestId);
  const requestId = request.id ?? responseRequestId;
  return typeof requestId === 'string' || typeof requestId === 'number'
    ? String(requestId)
    : randomUUID();
}

@Catch()
export class NativeResponseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(NativeResponseExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const requestId = resolveRequestId(request, response);

    response.setHeader(HTTP_HEADERS.requestId, requestId);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (status >= internalServerErrorStatus) {
        this.logUnexpected(exception, request, requestId);
      }

      response
        .status(status)
        .json(
          typeof exceptionResponse === 'object'
            ? exceptionResponse
            : { statusCode: status, message: exceptionResponse },
        );
      return;
    }

    this.logUnexpected(exception, request, requestId);
    response.status(internalServerErrorStatus).json({
      statusCode: internalServerErrorStatus,
      message: ERROR_MESSAGES.nativeInternalServerError,
    });
  }

  private logUnexpected(exception: unknown, request: Request, requestId: string): void {
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(
      `Unexpected error for ${request.method} ${request.path} [requestId=${requestId}]`,
      stack,
    );
  }
}
