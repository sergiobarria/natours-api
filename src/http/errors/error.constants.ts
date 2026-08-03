export const ERROR_CODES = {
  badRequest: 'BAD_REQUEST',
  conflict: 'CONFLICT',
  forbidden: 'FORBIDDEN',
  internalServerError: 'INTERNAL_SERVER_ERROR',
  methodNotAllowed: 'METHOD_NOT_ALLOWED',
  notFound: 'NOT_FOUND',
  tooManyRequests: 'TOO_MANY_REQUESTS',
  unauthorized: 'UNAUTHORIZED',
  unprocessableEntity: 'UNPROCESSABLE_ENTITY',
  validationFailed: 'VALIDATION_FAILED',
} as const;

export const ERROR_MESSAGES = {
  internalServerError: 'An unexpected error occurred.',
  nativeInternalServerError: 'Internal server error',
  validationFailed: 'The request contains invalid fields.',
} as const;

export const VALIDATION_ERROR_CODES = {
  invalidBoolean: 'INVALID_BOOLEAN',
  invalidDate: 'INVALID_DATE',
  invalidEmail: 'INVALID_EMAIL',
  invalidEnum: 'INVALID_ENUM_VALUE',
  invalidInteger: 'INVALID_INTEGER',
  invalidNumber: 'INVALID_NUMBER',
  invalidString: 'INVALID_STRING',
  invalidUuid: 'INVALID_UUID',
  required: 'REQUIRED',
  unknownField: 'UNKNOWN_FIELD',
  valueTooLarge: 'VALUE_TOO_LARGE',
  valueTooLong: 'VALUE_TOO_LONG',
  valueTooShort: 'VALUE_TOO_SHORT',
  valueTooSmall: 'VALUE_TOO_SMALL',
} as const;
