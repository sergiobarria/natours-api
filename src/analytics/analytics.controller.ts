import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../identity/identity.decorators.js';
import { PERMISSION } from '../identity/permissions.js';
import { SensitiveResponseInterceptor } from '../http/response/sensitive-response.interceptor.js';
import { AnalyticsRangeQueryDto, MonthlyPlanQueryDto, RankingsQueryDto } from './analytics.dto.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('tour-analytics')
@ApiTags('tour-analytics')
@ApiBearerAuth('bearerAuth')
@RequirePermissions(PERMISSION.toursViewAnalytics)
@UseInterceptors(SensitiveResponseInterceptor)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('rankings')
  @ApiOperation({ summary: 'Rank tours by realized revenue for a UTC departure interval' })
  @ApiOkResponse({
    description: 'Revenue-first tour rankings.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'rank',
          'tour',
          'confirmedBookings',
          'travelers',
          'revenueCents',
          'ratingAverage',
          'ratingCount',
        ],
        properties: {
          rank: { type: 'integer', minimum: 1 },
          tour: {
            type: 'object',
            required: ['id', 'name', 'isActive', 'isDeleted'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              isActive: { type: 'boolean' },
              isDeleted: { type: 'boolean' },
            },
          },
          confirmedBookings: { type: 'integer', minimum: 1 },
          travelers: { type: 'integer', minimum: 1 },
          revenueCents: { type: 'integer', minimum: 0 },
          ratingAverage: { type: 'number', nullable: true, minimum: 1, maximum: 5 },
          ratingCount: { type: 'integer', minimum: 0 },
        },
      },
    },
  })
  rankings(@Query() query: RankingsQueryDto) {
    return this.analytics.rankings(query);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get aggregate tour statistics for a UTC departure interval' })
  @ApiOkResponse({
    description: 'Historical departure, demand, and revenue totals.',
    schema: {
      type: 'object',
      required: [
        'from',
        'to',
        'tours',
        'departures',
        'capacity',
        'confirmedBookings',
        'travelers',
        'revenueCents',
        'averageBookingValueCents',
      ],
      properties: {
        from: { type: 'string', format: 'date' },
        to: { type: 'string', format: 'date' },
        tours: { type: 'integer', minimum: 0 },
        departures: { type: 'integer', minimum: 0 },
        capacity: { type: 'integer', minimum: 0 },
        confirmedBookings: { type: 'integer', minimum: 0 },
        travelers: { type: 'integer', minimum: 0 },
        revenueCents: { type: 'integer', minimum: 0 },
        averageBookingValueCents: { type: 'integer', nullable: true, minimum: 0 },
      },
    },
  })
  statistics(@Query() query: AnalyticsRangeQueryDto) {
    return this.analytics.statistics(query);
  }

  @Get('monthly-plan')
  @ApiOperation({ summary: 'Get sparse monthly operating plan for a UTC year' })
  @ApiOkResponse({
    description: 'Active scheduled capacity and confirmed demand by month.',
    schema: {
      type: 'object',
      required: ['year', 'months'],
      properties: {
        year: { type: 'integer', minimum: 2000, maximum: 2100 },
        months: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'month',
              'departureCount',
              'capacity',
              'reservedSpots',
              'confirmedBookings',
              'travelers',
              'revenueCents',
            ],
            properties: {
              month: { type: 'integer', minimum: 1, maximum: 12 },
              departureCount: { type: 'integer', minimum: 1 },
              capacity: { type: 'integer', minimum: 0 },
              reservedSpots: { type: 'integer', minimum: 0 },
              confirmedBookings: { type: 'integer', minimum: 0 },
              travelers: { type: 'integer', minimum: 0 },
              revenueCents: { type: 'integer', minimum: 0 },
            },
          },
        },
      },
    },
  })
  monthlyPlan(@Query() query: MonthlyPlanQueryDto) {
    return this.analytics.monthlyPlan(query);
  }
}
