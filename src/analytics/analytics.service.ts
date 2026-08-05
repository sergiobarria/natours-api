import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import type { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.constants.js';
import type {
  AnalyticsRangeQueryDto,
  MonthlyPlanQueryDto,
  RankingsQueryDto,
} from './analytics.dto.js';

interface RankingRow {
  id: string;
  name: string;
  is_active: boolean;
  deleted_at: Date | null;
  rating_average: string | null;
  rating_count: number;
  confirmed_bookings: string;
  travelers: string;
  revenue_cents: string;
}

interface StatisticsRow {
  tour_count: string;
  departure_count: string;
  capacity: string;
  confirmed_bookings: string;
  travelers: string;
  revenue_cents: string;
  average_booking_value_cents: string | null;
}

interface MonthlyPlanRow {
  month: number;
  departure_count: string;
  capacity: string;
  reserved_spots: string;
  confirmed_bookings: string;
  travelers: string;
  revenue_cents: string;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async rankings(query: RankingsQueryDto) {
    const { from, to } = parseRange(query);
    const rows = await this.timed('rankings', () =>
      this.pool.query<RankingRow>(
        `SELECT t.id, t.name, t.is_active, t.deleted_at, t.rating_average, t.rating_count,
                count(b.id)::text AS confirmed_bookings,
                coalesce(sum(b.quantity), 0)::text AS travelers,
                coalesce(sum(b.total_cents), 0)::text AS revenue_cents
           FROM bookings b
           JOIN tours t ON t.id = b.tour_id
          WHERE b.status = 'confirmed'
            AND b.departure_start_at >= $1
            AND b.departure_start_at < $2
          GROUP BY t.id
          ORDER BY coalesce(sum(b.total_cents), 0) DESC,
                   coalesce(sum(b.quantity), 0) DESC,
                   t.rating_average DESC NULLS LAST,
                   t.id ASC
          LIMIT $3`,
        [from, to, query.limit],
      ),
    );
    return rows.rows.map((row, index) => ({
      rank: index + 1,
      tour: {
        id: row.id,
        name: row.name,
        isActive: row.is_active,
        isDeleted: row.deleted_at !== null,
      },
      confirmedBookings: number(row.confirmed_bookings),
      travelers: number(row.travelers),
      revenueCents: number(row.revenue_cents),
      ratingAverage: row.rating_average === null ? null : Number(row.rating_average),
      ratingCount: row.rating_count,
    }));
  }

  async statistics(query: AnalyticsRangeQueryDto) {
    const { from, to } = parseRange(query);
    const result = await this.timed('statistics', () =>
      this.pool.query<StatisticsRow>(
        `WITH period_departures AS (
           SELECT id, tour_id, available_spots, reserved_spots
             FROM tour_departures
            WHERE start_at >= $1 AND start_at < $2
         ), period_bookings AS (
           SELECT id, tour_id, quantity, total_cents
             FROM bookings
            WHERE status = 'confirmed'
              AND departure_start_at >= $1
              AND departure_start_at < $2
         )
         SELECT (SELECT count(DISTINCT tour_id) FROM period_departures)::text AS tour_count,
                (SELECT count(*) FROM period_departures)::text AS departure_count,
                (SELECT coalesce(sum(available_spots + reserved_spots), 0)
                   FROM period_departures)::text AS capacity,
                (SELECT count(*) FROM period_bookings)::text AS confirmed_bookings,
                (SELECT coalesce(sum(quantity), 0) FROM period_bookings)::text AS travelers,
                (SELECT coalesce(sum(total_cents), 0) FROM period_bookings)::text AS revenue_cents,
                (SELECT round(avg(total_cents)) FROM period_bookings)::text
                  AS average_booking_value_cents`,
        [from, to],
      ),
    );
    const row = result.rows[0];
    return {
      from: query.from,
      to: query.to,
      tours: number(row?.tour_count),
      departures: number(row?.departure_count),
      capacity: number(row?.capacity),
      confirmedBookings: number(row?.confirmed_bookings),
      travelers: number(row?.travelers),
      revenueCents: number(row?.revenue_cents),
      averageBookingValueCents:
        row?.average_booking_value_cents === null || row?.average_booking_value_cents === undefined
          ? null
          : number(row.average_booking_value_cents),
    };
  }

  async monthlyPlan(query: MonthlyPlanQueryDto) {
    const from = new Date(Date.UTC(query.year, 0, 1));
    const to = new Date(Date.UTC(query.year + 1, 0, 1));
    const result = await this.timed('monthly-plan', () =>
      this.pool.query<MonthlyPlanRow>(
        `WITH plan_departures AS (
           SELECT d.id, d.tour_id, d.start_at, d.available_spots, d.reserved_spots
             FROM tour_departures d
             JOIN tours t ON t.id = d.tour_id
            WHERE d.start_at >= $1 AND d.start_at < $2
              AND d.is_active = true AND d.deleted_at IS NULL
              AND t.is_active = true AND t.deleted_at IS NULL
         ), booking_totals AS (
           SELECT b.departure_id, count(*) AS confirmed_bookings,
                  sum(b.quantity) AS travelers, sum(b.total_cents) AS revenue_cents
             FROM bookings b
             JOIN plan_departures d ON d.id = b.departure_id
            WHERE b.status = 'confirmed'
            GROUP BY b.departure_id
         )
         SELECT extract(month FROM d.start_at)::integer AS month,
                count(*)::text AS departure_count,
                sum(d.available_spots + d.reserved_spots)::text AS capacity,
                sum(d.reserved_spots)::text AS reserved_spots,
                coalesce(sum(b.confirmed_bookings), 0)::text AS confirmed_bookings,
                coalesce(sum(b.travelers), 0)::text AS travelers,
                coalesce(sum(b.revenue_cents), 0)::text AS revenue_cents
           FROM plan_departures d
           LEFT JOIN booking_totals b ON b.departure_id = d.id
          GROUP BY extract(month FROM d.start_at)
          ORDER BY month ASC`,
        [from, to],
      ),
    );
    return {
      year: query.year,
      months: result.rows.map(row => ({
        month: row.month,
        departureCount: number(row.departure_count),
        capacity: number(row.capacity),
        reservedSpots: number(row.reserved_spots),
        confirmedBookings: number(row.confirmed_bookings),
        travelers: number(row.travelers),
        revenueCents: number(row.revenue_cents),
      })),
    };
  }

  private async timed<T>(report: string, query: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    try {
      return await query();
    } finally {
      this.logger.log({ durationMs: Math.round(performance.now() - startedAt), report });
    }
  }
}

function parseRange(query: AnalyticsRangeQueryDto): { from: Date; to: Date } {
  const from = utcDate(query.from);
  const to = utcDate(query.to);
  if (from >= to) throw new BadRequestException('from must be earlier than to.');
  if (to.getTime() - from.getTime() > 366 * 86_400_000) {
    throw new BadRequestException('Analytics intervals cannot exceed 366 days.');
  }
  return { from, to };
}

function utcDate(value: string): Date {
  const result = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Dates must be valid UTC calendar dates.');
  }
  return result;
}

function number(value: string | undefined): number {
  return Number(value ?? 0);
}
