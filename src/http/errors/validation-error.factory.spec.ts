import type { ValidationError } from 'class-validator';
import { ERROR_CODES, VALIDATION_ERROR_CODES } from './error.constants.js';
import { createValidationError, flattenValidationErrors } from './validation-error.factory.js';

describe('validation error presentation', () => {
  const errors: ValidationError[] = [
    {
      property: 'travelers',
      children: [
        {
          property: '0',
          children: [
            {
              property: 'email',
              constraints: { isEmail: 'Email must be a valid address.' },
              children: [],
            },
          ],
        },
      ],
    },
    {
      property: 'unexpected',
      constraints: { whitelistValidation: 'property unexpected should not exist' },
      children: [],
    },
  ];

  it('flattens nested field paths and stable constraint codes', () => {
    expect(flattenValidationErrors(errors)).toEqual([
      {
        field: 'travelers.0.email',
        code: VALIDATION_ERROR_CODES.invalidEmail,
        message: 'Email must be a valid address.',
      },
      {
        field: 'unexpected',
        code: VALIDATION_ERROR_CODES.unknownField,
        message: 'property unexpected should not exist',
      },
    ]);
  });

  it('creates a safe domain error for the global exception filter', () => {
    const error = createValidationError(errors);

    expect(error.code).toBe(ERROR_CODES.validationFailed);
    expect(error.status).toBe(400);
    expect(error.details).toEqual(flattenValidationErrors(errors));
  });
});
