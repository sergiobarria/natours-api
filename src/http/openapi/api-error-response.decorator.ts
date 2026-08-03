import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { REQUEST_ID_CONTRACT } from '../http.constants.js';

export interface ApiErrorResponseOptions {
  status: number;
  code: string;
  message: string;
  description?: string;
}

export function ApiErrorResponse(options: ApiErrorResponseOptions): MethodDecorator {
  return applyDecorators(
    ApiResponse({
      status: options.status,
      description: options.description,
      schema: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message', 'requestId'],
            properties: {
              code: { type: 'string', example: options.code },
              message: { type: 'string', example: options.message },
              details: { nullable: true },
              requestId: {
                type: 'string',
                minLength: REQUEST_ID_CONTRACT.minLength,
                maxLength: REQUEST_ID_CONTRACT.maxLength,
                pattern: REQUEST_ID_CONTRACT.pattern,
              },
            },
          },
        },
      },
    }),
  );
}
