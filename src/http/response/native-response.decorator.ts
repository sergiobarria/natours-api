import { applyDecorators, SetMetadata, UseFilters } from '@nestjs/common';
import { NativeResponseExceptionFilter } from './native-response-exception.filter.js';

export const NATIVE_RESPONSE_METADATA = Symbol('NATIVE_RESPONSE_METADATA');

export const NativeResponse = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(NATIVE_RESPONSE_METADATA, true),
    UseFilters(NativeResponseExceptionFilter),
  );
