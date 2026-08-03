import { Controller, Get, HttpStatus, Version } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { ERROR_CODES, ERROR_MESSAGES } from './http/errors/error.constants.js';
import { API_CONTRACT } from './http/http.constants.js';
import { ApiErrorResponse } from './http/openapi/api-error-response.decorator.js';

export interface ApiDescription {
  name: string;
  version: string;
}

@ApiTags('application')
@AllowAnonymous()
@Controller()
export class AppController {
  @Get()
  @Version(API_CONTRACT.version)
  @ApiOperation({ summary: 'Describe the API' })
  @ApiErrorResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ERROR_CODES.internalServerError,
    message: ERROR_MESSAGES.internalServerError,
    description: 'Unexpected internal failure',
  })
  @ApiOkResponse({
    schema: {
      example: {
        data: { name: API_CONTRACT.serviceName, version: API_CONTRACT.version },
      },
      required: ['data'],
      properties: {
        data: {
          type: 'object',
          required: ['name', 'version'],
          properties: {
            name: { type: 'string', example: API_CONTRACT.serviceName },
            version: { type: 'string', example: API_CONTRACT.version },
          },
        },
      },
      type: 'object',
    },
  })
  describe(): ApiDescription {
    return { name: API_CONTRACT.serviceName, version: API_CONTRACT.version };
  }
}
