import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { NATIVE_RESPONSE_METADATA } from './native-response.decorator.js';
import { isPresentedResponse, presentCollection, presentResource } from './response.presenter.js';
import type { CollectionResponse, PaginatedResponse, ResourceResponse } from './response.types.js';

const noContentStatus: number = HttpStatus.NO_CONTENT;

export type EnvelopedResponse<T> =
  | T
  | ResourceResponse<T>
  | CollectionResponse<unknown>
  | PaginatedResponse<unknown>
  | StreamableFile
  | undefined;

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, EnvelopedResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<EnvelopedResponse<T>> {
    const nativeResponse = this.reflector.getAllAndOverride<boolean>(NATIVE_RESPONSE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();

    return next.handle().pipe(
      map(value => {
        if (
          nativeResponse === true ||
          response.statusCode === noContentStatus ||
          value instanceof StreamableFile ||
          isPresentedResponse(value)
        ) {
          return value;
        }

        return Array.isArray(value) ? presentCollection(value) : presentResource(value);
      }),
    );
  }
}
