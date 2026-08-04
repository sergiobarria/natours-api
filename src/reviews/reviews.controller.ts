import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedPrincipal } from '../identity/authentication.types.js';
import { CurrentPrincipal, PublicRoute } from '../identity/identity.decorators.js';
import { presentPaginated } from '../http/response/response.presenter.js';
import { RateLimitPolicy } from '../rate-limit/rate-limit.decorators.js';
import { RATE_LIMIT_POLICY } from '../rate-limit/rate-limit.constants.js';
import { ReviewCustomerGuard } from './review-customer.guard.js';
import { ListReviewsQueryDto, ReviewBodyDto, UpdateReviewDto } from './reviews.dto.js';
import { ReviewsService } from './reviews.service.js';

@Controller('tours/:tourId/reviews')
@ApiTags('reviews')
@ApiParam({ name: 'tourId', format: 'uuid' })
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @PublicRoute()
  @ApiOkResponse({ description: 'Newest-first public tour reviews.' })
  @ApiQuery({ type: ListReviewsQueryDto })
  async list(@Param('tourId', ParseUUIDPipe) tourId: string, @Query() query: ListReviewsQueryDto) {
    const result = await this.reviews.list(tourId, query);
    return presentPaginated(result.items, {
      page: query.page,
      perPage: query.limit,
      totalItems: result.total,
      path: `/api/v1/tours/${tourId}/reviews`,
      query: { ...query },
    });
  }

  @Get(':reviewId')
  @PublicRoute()
  @ApiParam({ name: 'reviewId', format: 'uuid' })
  @ApiOkResponse({ description: 'Public tour review.' })
  async detail(
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    return await this.reviews.detail(tourId, reviewId);
  }

  @Post()
  @ApiBearerAuth('bearerAuth')
  @UseGuards(ReviewCustomerGuard)
  @RateLimitPolicy(RATE_LIMIT_POLICY.review)
  @ApiCreatedResponse({ description: 'Qualified customer review created.' })
  @ApiBody({ type: ReviewBodyDto })
  async create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Body() body: ReviewBodyDto,
  ) {
    return await this.reviews.create(principal.userId, tourId, body);
  }

  @Patch(':reviewId')
  @ApiBearerAuth('bearerAuth')
  @UseGuards(ReviewCustomerGuard)
  @RateLimitPolicy(RATE_LIMIT_POLICY.review)
  @ApiParam({ name: 'reviewId', format: 'uuid' })
  @ApiOkResponse({ description: 'Author-owned review updated.' })
  @ApiBody({ type: UpdateReviewDto })
  async update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() body: UpdateReviewDto,
  ) {
    if (Object.keys(body).length === 0) {
      throw new BadRequestException('At least one field is required.');
    }
    return await this.reviews.update(principal.userId, tourId, reviewId, body);
  }

  @Delete(':reviewId')
  @ApiBearerAuth('bearerAuth')
  @UseGuards(ReviewCustomerGuard)
  @RateLimitPolicy(RATE_LIMIT_POLICY.review)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'reviewId', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Author-owned review hard deleted.' })
  async delete(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    await this.reviews.delete(principal.userId, tourId, reviewId);
  }
}
