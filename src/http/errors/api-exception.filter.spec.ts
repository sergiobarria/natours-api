import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  MethodNotAllowedException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DomainError } from './domain.error.js';
import { ERROR_CODES, ERROR_MESSAGES } from './error.constants.js';
import { mapException } from './api-exception.filter.js';

describe('exception mapping', () => {
  it.each([
    [new BadRequestException('Bad input'), ERROR_CODES.badRequest, HttpStatus.BAD_REQUEST],
    [new UnauthorizedException(), ERROR_CODES.unauthorized, HttpStatus.UNAUTHORIZED],
    [new ForbiddenException(), ERROR_CODES.forbidden, HttpStatus.FORBIDDEN],
    [new NotFoundException(), ERROR_CODES.notFound, HttpStatus.NOT_FOUND],
    [new MethodNotAllowedException(), ERROR_CODES.methodNotAllowed, HttpStatus.METHOD_NOT_ALLOWED],
    [new ConflictException(), ERROR_CODES.conflict, HttpStatus.CONFLICT],
    [
      new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS),
      ERROR_CODES.tooManyRequests,
      HttpStatus.TOO_MANY_REQUESTS,
    ],
  ])('maps standard HTTP exceptions to stable codes', (exception, code, status) => {
    expect(mapException(exception)).toMatchObject({ code, status, unexpected: false });
  });

  it('preserves safe domain error contracts', () => {
    const error = new DomainError({
      code: 'TOUR_NOT_BOOKABLE',
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      message: 'The selected tour cannot be booked.',
      details: { reason: 'inactive' },
    });

    expect(mapException(error)).toEqual({
      code: 'TOUR_NOT_BOOKABLE',
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      message: 'The selected tour cannot be booked.',
      details: { reason: 'inactive' },
      unexpected: false,
    });
  });

  it('hides unexpected error messages', () => {
    expect(mapException(new Error('database password leaked'))).toEqual({
      code: ERROR_CODES.internalServerError,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: ERROR_MESSAGES.internalServerError,
      unexpected: true,
    });
  });

  it('treats 5xx HTTP exceptions as unexpected and hides their messages', () => {
    expect(mapException(new InternalServerErrorException('database password leaked'))).toEqual({
      code: ERROR_CODES.internalServerError,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: ERROR_MESSAGES.internalServerError,
      unexpected: true,
    });
  });
});
