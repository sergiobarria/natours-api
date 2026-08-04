import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DATABASE } from '../database/database.constants.js';
import { DatabaseUnitOfWork } from '../database/database-unit-of-work.js';
import { bookings } from '../database/schema/bookings.js';
import { users } from '../database/schema/identity.js';
import { reviews } from '../database/schema/reviews.js';
import { tours } from '../database/schema/tours.js';
import type { Database, DatabaseTransaction } from '../database/database.types.js';
import { DomainError } from '../http/errors/domain.error.js';
import type { ListReviewsQueryDto, ReviewBodyDto, UpdateReviewDto } from './reviews.dto.js';

const reviewColumns = {
  id: reviews.id,
  tourId: reviews.tourId,
  rating: reviews.rating,
  text: reviews.text,
  userId: users.id,
  userName: users.name,
  createdAt: reviews.createdAt,
  updatedAt: reviews.updatedAt,
};

interface ReviewRow {
  id: string;
  tourId: string;
  rating: number;
  text: string;
  userId: string;
  userName: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(DatabaseUnitOfWork) private readonly uow: DatabaseUnitOfWork,
  ) {}

  async list(tourId: string, query: ListReviewsQueryDto) {
    await this.requirePublicTour(tourId);
    const [{ total }] = await this.database
      .select({ total: count() })
      .from(reviews)
      .where(eq(reviews.tourId, tourId));
    const rows = await this.database
      .select(reviewColumns)
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.userId))
      .where(eq(reviews.tourId, tourId))
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
    return { items: rows.map(present), total };
  }

  async detail(tourId: string, reviewId: string) {
    await this.requirePublicTour(tourId);
    const row = await this.load(this.database, tourId, reviewId);
    if (!row) throw new NotFoundException('Review not found.');
    return present(row);
  }

  async create(userId: string, tourId: string, input: ReviewBodyDto) {
    try {
      return await this.uow.transaction(async tx => {
        await this.lockTour(tx, tourId);
        const [qualifying] = await tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(
            and(
              eq(bookings.userId, userId),
              eq(bookings.tourId, tourId),
              eq(bookings.status, 'confirmed'),
              lt(bookings.departureStartAt, new Date()),
            ),
          )
          .limit(1);
        if (!qualifying) {
          throw new DomainError({
            code: 'REVIEW_NOT_QUALIFIED',
            status: 422,
            message: 'A confirmed past booking is required to review this tour.',
          });
        }
        const id = randomUUID();
        await tx
          .insert(reviews)
          .values({ id, userId, tourId, rating: input.rating, text: input.text });
        await this.recompute(tx, tourId);
        const row = await this.load(tx, tourId, id);
        if (!row) throw new NotFoundException('Review not found.');
        return present(row);
      });
    } catch (error) {
      if (isDuplicate(error)) {
        throw new DomainError({
          code: 'REVIEW_ALREADY_EXISTS',
          status: 409,
          message: 'You have already reviewed this tour.',
        });
      }
      throw error;
    }
  }

  update(userId: string, tourId: string, reviewId: string, input: UpdateReviewDto) {
    return this.uow.transaction(async tx => {
      await this.lockTour(tx, tourId);
      const existing = await this.loadOwned(tx, userId, tourId, reviewId);
      if (!existing) throw new NotFoundException('Review not found.');
      await tx
        .update(reviews)
        .set({
          ...(input.rating !== undefined && { rating: input.rating }),
          ...(input.text !== undefined && { text: input.text }),
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, reviewId));
      await this.recompute(tx, tourId);
      const row = await this.load(tx, tourId, reviewId);
      if (!row) throw new NotFoundException('Review not found.');
      return present(row);
    });
  }

  delete(userId: string, tourId: string, reviewId: string) {
    return this.uow.transaction(async tx => {
      await this.lockTour(tx, tourId);
      const existing = await this.loadOwned(tx, userId, tourId, reviewId);
      if (!existing) throw new NotFoundException('Review not found.');
      await tx.delete(reviews).where(eq(reviews.id, reviewId));
      await this.recompute(tx, tourId);
    });
  }

  private async requirePublicTour(tourId: string) {
    const [tour] = await this.database
      .select({ id: tours.id })
      .from(tours)
      .where(and(eq(tours.id, tourId), eq(tours.isActive, true), isNull(tours.deletedAt)))
      .limit(1);
    if (!tour) throw new NotFoundException('Tour not found.');
  }

  private async lockTour(tx: DatabaseTransaction, tourId: string) {
    const [tour] = await tx
      .select({ id: tours.id })
      .from(tours)
      .where(and(eq(tours.id, tourId), isNull(tours.deletedAt)))
      .for('update')
      .limit(1);
    if (!tour) throw new NotFoundException('Tour not found.');
  }

  private load(database: Database | DatabaseTransaction, tourId: string, reviewId: string) {
    return database
      .select(reviewColumns)
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.userId))
      .where(and(eq(reviews.id, reviewId), eq(reviews.tourId, tourId)))
      .limit(1)
      .then(rows => rows[0]);
  }

  private loadOwned(
    database: Database | DatabaseTransaction,
    userId: string,
    tourId: string,
    reviewId: string,
  ) {
    return database
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.id, reviewId), eq(reviews.tourId, tourId), eq(reviews.userId, userId)))
      .limit(1)
      .then(rows => rows[0]);
  }

  private async recompute(tx: DatabaseTransaction, tourId: string) {
    const [aggregate] = await tx
      .select({
        count: count(),
        average: sql<string | null>`round(avg(${reviews.rating})::numeric, 2)`,
      })
      .from(reviews)
      .where(eq(reviews.tourId, tourId));
    await tx
      .update(tours)
      .set({
        ratingCount: aggregate?.count ?? 0,
        ratingAverage: aggregate?.average ?? null,
        updatedAt: new Date(),
      })
      .where(eq(tours.id, tourId));
  }
}

function present(row: ReviewRow) {
  return {
    id: row.id,
    tourId: row.tourId,
    rating: row.rating,
    text: row.text,
    user: { id: row.userId, name: row.userName },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isDuplicate(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if (
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    error.constraint === 'reviews_user_id_tour_id_unique'
  ) {
    return true;
  }
  return 'cause' in error && isDuplicate(error.cause);
}
