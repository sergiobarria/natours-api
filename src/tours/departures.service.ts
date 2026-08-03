import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DrizzleAuditRecorder } from '../audit/drizzle-audit-recorder.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseTransaction } from '../database/database.types.js';
import { tourDepartures, tours } from '../database/schema/tours.js';
import { DatabaseUnitOfWork } from '../database/database-unit-of-work.js';
import { TourPolicyError } from './tour.errors.js';
import type { CreateDepartureDto, UpdateDepartureDto } from './departures.dto.js';

const selection = {
  id: tourDepartures.id,
  tourId: tourDepartures.tourId,
  startAt: tourDepartures.startAt,
  availableSpots: tourDepartures.availableSpots,
  reservedSpots: tourDepartures.reservedSpots,
  isActive: tourDepartures.isActive,
  createdAt: tourDepartures.createdAt,
  updatedAt: tourDepartures.updatedAt,
};

@Injectable()
export class DeparturesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly unitOfWork: DatabaseUnitOfWork,
    private readonly audit: DrizzleAuditRecorder,
  ) {}

  async publicList(tourId: string) {
    await this.requirePublicTour(tourId);
    return this.database
      .select({
        id: tourDepartures.id,
        tourId: tourDepartures.tourId,
        startAt: tourDepartures.startAt,
        availableSpots: tourDepartures.availableSpots,
        createdAt: tourDepartures.createdAt,
        updatedAt: tourDepartures.updatedAt,
      })
      .from(tourDepartures)
      .where(
        and(
          eq(tourDepartures.tourId, tourId),
          eq(tourDepartures.isActive, true),
          isNull(tourDepartures.deletedAt),
          gt(tourDepartures.startAt, new Date()),
        ),
      )
      .orderBy(asc(tourDepartures.startAt), asc(tourDepartures.id));
  }

  create(actorId: string, tourId: string, input: CreateDepartureDto, requestId?: string) {
    const startAt = new Date(input.startAt);
    this.requireFuture(startAt);
    return this.unitOfWork.transaction(async transaction => {
      const tour = await this.lockTour(transaction, tourId);
      this.requireCapacity(input.availableSpots, 0, tour.maximumGroupSize);
      try {
        const [row] = await transaction
          .insert(tourDepartures)
          .values({
            id: randomUUID(),
            tourId,
            startAt,
            availableSpots: input.availableSpots,
            isActive: input.isActive,
          })
          .returning(selection);
        await this.recordAudit(transaction, actorId, row.id, 'created', row, requestId);
        return row;
      } catch (error) {
        if (isScheduleConflict(error)) {
          throw new ConflictException('A departure already exists at this instant.');
        }
        throw error;
      }
    });
  }

  update(
    actorId: string,
    tourId: string,
    departureId: string,
    input: UpdateDepartureDto,
    requestId?: string,
  ) {
    const startAt = input.startAt === undefined ? undefined : new Date(input.startAt);
    if (startAt) this.requireFuture(startAt);
    return this.unitOfWork.transaction(async transaction => {
      const tour = await this.lockTour(transaction, tourId);
      const existing = await this.lockDeparture(transaction, tourId, departureId);
      if (existing.reservedSpots > 0 && (input.startAt !== undefined || input.isActive === false)) {
        throw new TourPolicyError(
          'DEPARTURE_HAS_RESERVATIONS',
          'A reserved departure cannot be moved or deactivated.',
        );
      }
      const available = input.availableSpots ?? existing.availableSpots;
      this.requireCapacity(available, existing.reservedSpots, tour.maximumGroupSize);
      try {
        const [row] = await transaction
          .update(tourDepartures)
          .set({
            ...(startAt !== undefined && { startAt }),
            ...(input.availableSpots !== undefined && { availableSpots: input.availableSpots }),
            ...(input.isActive !== undefined && { isActive: input.isActive }),
            updatedAt: new Date(),
          })
          .where(eq(tourDepartures.id, departureId))
          .returning(selection);
        await this.recordAudit(transaction, actorId, departureId, 'updated', row, requestId);
        return row;
      } catch (error) {
        if (isScheduleConflict(error)) {
          throw new ConflictException('A departure already exists at this instant.');
        }
        throw error;
      }
    });
  }

  delete(actorId: string, tourId: string, departureId: string, requestId?: string): Promise<void> {
    return this.unitOfWork.transaction(async transaction => {
      await this.lockTour(transaction, tourId);
      const existing = await this.lockDeparture(transaction, tourId, departureId);
      if (existing.reservedSpots > 0) {
        throw new TourPolicyError(
          'DEPARTURE_HAS_RESERVATIONS',
          'A reserved departure cannot be deleted.',
        );
      }
      await transaction
        .update(tourDepartures)
        .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
        .where(eq(tourDepartures.id, departureId));
      await this.recordAudit(transaction, actorId, departureId, 'deleted', existing, requestId);
    });
  }

  private async lockTour(transaction: DatabaseTransaction, tourId: string) {
    const [tour] = await transaction
      .select({ id: tours.id, maximumGroupSize: tours.maximumGroupSize })
      .from(tours)
      .where(and(eq(tours.id, tourId), isNull(tours.deletedAt)))
      .for('update')
      .limit(1);
    if (!tour) throw new NotFoundException('Tour not found.');
    return tour;
  }

  private async lockDeparture(
    transaction: DatabaseTransaction,
    tourId: string,
    departureId: string,
  ) {
    const [departure] = await transaction
      .select(selection)
      .from(tourDepartures)
      .where(
        and(
          eq(tourDepartures.id, departureId),
          eq(tourDepartures.tourId, tourId),
          isNull(tourDepartures.deletedAt),
        ),
      )
      .for('update')
      .limit(1);
    if (!departure) throw new NotFoundException('Departure not found.');
    return departure;
  }

  private async requirePublicTour(tourId: string): Promise<void> {
    const [tour] = await this.database
      .select({ id: tours.id })
      .from(tours)
      .where(and(eq(tours.id, tourId), eq(tours.isActive, true), isNull(tours.deletedAt)))
      .limit(1);
    if (!tour) throw new NotFoundException('Tour not found.');
  }

  private requireFuture(startAt: Date): void {
    if (startAt.getTime() <= Date.now()) {
      throw new TourPolicyError('DEPARTURE_NOT_FUTURE', 'Departure start time must be future.');
    }
  }

  private requireCapacity(available: number, reserved: number, capacity: number): void {
    if (available + reserved > capacity) {
      throw new TourPolicyError(
        'DEPARTURE_CAPACITY_EXCEEDED',
        'Departure inventory exceeds tour capacity.',
      );
    }
  }

  private recordAudit(
    transaction: DatabaseTransaction,
    actorId: string,
    departureId: string,
    status: string,
    row: { availableSpots: number; isActive: boolean; startAt: Date },
    requestId?: string,
  ) {
    return this.audit.record(transaction, {
      action: 'tour.departure_changed',
      actor: { type: 'user', userId: actorId },
      after: {
        status,
        startAt: row.startAt.toISOString(),
        availableSpots: row.availableSpots,
        isActive: row.isActive,
      },
      eventKey: randomUUID(),
      requestId,
      targetId: departureId,
      targetType: 'tour_departure',
    });
  }
}

function isScheduleConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('code' in error && error.code === '23505') return true;
  return 'cause' in error && isScheduleConflict(error.cause);
}
