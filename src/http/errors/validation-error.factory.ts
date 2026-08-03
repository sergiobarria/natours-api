import { HttpStatus } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { DomainError } from './domain.error.js';
import { ERROR_CODES, ERROR_MESSAGES, VALIDATION_ERROR_CODES } from './error.constants.js';
import type { ValidationDetail } from './error.types.js';

const validationConstraintCodes: Readonly<Record<string, string>> = {
  isBoolean: VALIDATION_ERROR_CODES.invalidBoolean,
  isDate: VALIDATION_ERROR_CODES.invalidDate,
  isEmail: VALIDATION_ERROR_CODES.invalidEmail,
  isEnum: VALIDATION_ERROR_CODES.invalidEnum,
  isInt: VALIDATION_ERROR_CODES.invalidInteger,
  isNotEmpty: VALIDATION_ERROR_CODES.required,
  isNumber: VALIDATION_ERROR_CODES.invalidNumber,
  isString: VALIDATION_ERROR_CODES.invalidString,
  isUuid: VALIDATION_ERROR_CODES.invalidUuid,
  max: VALIDATION_ERROR_CODES.valueTooLarge,
  maxLength: VALIDATION_ERROR_CODES.valueTooLong,
  min: VALIDATION_ERROR_CODES.valueTooSmall,
  minLength: VALIDATION_ERROR_CODES.valueTooShort,
  whitelistValidation: VALIDATION_ERROR_CODES.unknownField,
};

function fallbackConstraintCode(constraint: string): string {
  return `INVALID_${constraint.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()}`;
}

export function flattenValidationErrors(
  errors: readonly ValidationError[],
  parentPath?: string,
): ValidationDetail[] {
  return errors.flatMap(error => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const ownDetails = Object.entries(error.constraints ?? {}).map(([constraint, message]) => ({
      field,
      code: validationConstraintCodes[constraint] ?? fallbackConstraintCode(constraint),
      message,
    }));
    return [...ownDetails, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

export function createValidationError(errors: ValidationError[]): DomainError {
  return new DomainError({
    code: ERROR_CODES.validationFailed,
    status: HttpStatus.BAD_REQUEST,
    message: ERROR_MESSAGES.validationFailed,
    details: flattenValidationErrors(errors),
  });
}
