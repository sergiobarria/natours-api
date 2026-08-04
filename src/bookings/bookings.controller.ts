import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentPrincipal, PublicRoute } from '../identity/identity.decorators.js';
import type { AuthenticatedPrincipal } from '../identity/authentication.types.js';
import { presentPaginated } from '../http/response/response.presenter.js';
import { SensitiveResponseInterceptor } from '../http/response/sensitive-response.interceptor.js';
import {
  PAYMENT_GATEWAY,
  PaymentGatewayError,
  type PaymentGateway,
} from '../payments/payment-gateway.js';
import { RateLimitPolicy } from '../rate-limit/rate-limit.decorators.js';
import { RATE_LIMIT_POLICY } from '../rate-limit/rate-limit.constants.js';
import { CreateBookingDto, ListBookingsQueryDto } from './bookings.dto.js';
import { BookingsService } from './bookings.service.js';

@Controller('bookings')
@ApiTags('bookings')
@ApiBearerAuth('bearerAuth')
@UseInterceptors(SensitiveResponseInterceptor)
@RateLimitPolicy(RATE_LIMIT_POLICY.booking)
export class BookingsController {
  constructor(@Inject(BookingsService) private readonly bookings: BookingsService) {}

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiCreatedResponse({ description: 'Booking created or replayed.' })
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: CreateBookingDto,
    @Req() request: Request,
  ) {
    return this.bookings.create(principal, key ?? '', body, requestId(request));
  }

  @Get()
  @ApiOkResponse({ description: 'Owner booking history.' })
  async list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListBookingsQueryDto,
  ) {
    this.bookings.requireVerified(principal);
    const result = await this.bookings.list(principal.userId, query);
    return presentPaginated(result.items, {
      page: query.page,
      perPage: query.limit,
      totalItems: result.total,
      path: '/api/v1/bookings',
      query: { ...query },
    });
  }

  @Get(':bookingId')
  detail(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('bookingId', ParseUUIDPipe) id: string,
  ) {
    this.bookings.requireVerified(principal);
    return this.bookings.detail(principal.userId, id);
  }

  @Post(':bookingId/cancellation')
  async cancel(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('bookingId', ParseUUIDPipe) id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.bookings.requireVerified(principal);
    const result = await this.bookings.cancel(principal.userId, id, requestId(request));
    response.status(result.status === 'cancelled' ? HttpStatus.OK : HttpStatus.ACCEPTED);
    return result;
  }
}

@Controller('stripe')
@ApiTags('stripe')
@PublicRoute()
@RateLimitPolicy(RATE_LIMIT_POLICY.webhook)
export class StripeWebhookController {
  constructor(
    @Inject(BookingsService) private readonly bookings: BookingsService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.NO_CONTENT)
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    const rawBody = request.rawBody ?? (Buffer.isBuffer(request.body) ? request.body : undefined);
    if (!signature || !rawBody) throw new UnauthorizedException('Invalid payment signature.');
    try {
      await this.bookings.processEvent(this.gateway.verifyEvent(rawBody, signature));
    } catch (error) {
      if (error instanceof PaymentGatewayError && error.code === 'unsupported_event') return;
      if (error instanceof PaymentGatewayError && error.code === 'invalid_signature') {
        throw new UnauthorizedException('Invalid payment signature.');
      }
      throw error;
    }
  }
}

function requestId(request: Request) {
  return typeof request.id === 'string' || typeof request.id === 'number'
    ? String(request.id)
    : undefined;
}
