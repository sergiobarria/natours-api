import slugify from '@sindresorhus/slugify';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  type SQL,
} from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DrizzleAuditRecorder } from '../audit/drizzle-audit-recorder.js';
import { DatabaseUnitOfWork } from '../database/database-unit-of-work.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseTransaction } from '../database/database.types.js';
import { users } from '../database/schema/identity.js';
import { tourGuideAssignments, tours } from '../database/schema/tours.js';
import { TourPolicyError } from './tour.errors.js';
import type {
  CreateTourDto,
  ListToursQueryDto,
  ReplaceGuideTeamDto,
  UpdateTourDto,
} from './tours.dto.js';

type GuideTeamInput = Pick<ReplaceGuideTeamDto, 'leadGuideId' | 'guideIds'>;
type TourWriteInput = Omit<CreateTourDto, 'leadGuideId' | 'guideIds'>;
type TourRow = typeof tours.$inferSelect;

const tourSelection = {
  createdAt: tours.createdAt,
  deletedAt: tours.deletedAt,
  description: tours.description,
  difficulty: tours.difficulty,
  discountPercentage: tours.discountPercentage,
  durationDays: tours.durationDays,
  id: tours.id,
  isActive: tours.isActive,
  maximumGroupSize: tours.maximumGroupSize,
  name: tours.name,
  price: tours.priceCents,
  ratingAverage: tours.ratingAverage,
  ratingCount: tours.ratingCount,
  slug: tours.slug,
  startLocationAddress: tours.startLocationAddress,
  startLocationLatitude: tours.startLocationLatitude,
  startLocationLongitude: tours.startLocationLongitude,
  startLocationName: tours.startLocationName,
  summary: tours.summary,
  updatedAt: tours.updatedAt,
};

interface TourProjection {
  createdAt: Date;
  deletedAt: Date | null;
  description: string | null;
  difficulty: TourRow['difficulty'];
  discountPercentage: string | null;
  durationDays: number;
  id: string;
  isActive: boolean;
  maximumGroupSize: number;
  name: string;
  price: number;
  ratingAverage: string | null;
  ratingCount: number;
  slug: string;
  startLocationAddress: string | null;
  startLocationLatitude: number;
  startLocationLongitude: number;
  startLocationName: string;
  summary: string;
  updatedAt: Date;
}

@Injectable()
export class ToursService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(DatabaseUnitOfWork) private readonly unitOfWork: DatabaseUnitOfWork,
    private readonly audit: DrizzleAuditRecorder,
  ) {}

  async create(actorId: string, input: TourWriteInput, team: GuideTeamInput, requestId?: string) {
    const baseSlug = slugify(input.name);
    if (!baseSlug) {
      throw new TourPolicyError('INVALID_TOUR_NAME', 'Tour name must contain letters or numbers.');
    }

    for (let suffix = 1; suffix <= 100; suffix += 1) {
      const slug = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`;
      const [existing] = await this.database
        .select({ id: tours.id })
        .from(tours)
        .where(eq(tours.slug, slug))
        .limit(1);
      if (existing) continue;
      try {
        return await this.createWithSlug(actorId, input, team, slug, requestId);
      } catch (error) {
        if (!isSlugConflict(error)) throw error;
      }
    }
    throw new TourPolicyError('TOUR_SLUG_EXHAUSTED', 'A unique tour slug could not be generated.');
  }

  update(actorId: string, tourId: string, input: UpdateTourDto, requestId?: string) {
    return this.unitOfWork.transaction(async transaction => {
      const existing = await this.lockTour(transaction, tourId);
      const [updated] = await transaction
        .update(tours)
        .set(this.patchValues(input))
        .where(and(eq(tours.id, tourId), isNull(tours.deletedAt)))
        .returning(tourSelection);
      if (!updated) throw new NotFoundException('Tour not found.');
      await this.audit.record(transaction, {
        action: 'tour.changed',
        actor: { type: 'user', userId: actorId },
        before: { status: existing.isActive ? 'active' : 'inactive' },
        after: { status: updated.isActive ? 'active' : 'inactive' },
        eventKey: randomUUID(),
        requestId,
        targetId: tourId,
        targetType: 'tour',
      });
      return this.present(updated, await this.loadGuides(transaction, tourId), true);
    });
  }

  replaceGuideTeam(actorId: string, tourId: string, team: GuideTeamInput, requestId?: string) {
    return this.unitOfWork.transaction(async transaction => {
      await this.lockTour(transaction, tourId);
      await this.replaceTeam(transaction, tourId, team);
      await this.recordTeamAudit(transaction, actorId, tourId, team, requestId);
      const [tour] = await transaction
        .select(tourSelection)
        .from(tours)
        .where(eq(tours.id, tourId));
      if (!tour) throw new NotFoundException('Tour not found.');
      return this.present(tour, await this.loadGuides(transaction, tourId), true);
    });
  }

  delete(actorId: string, tourId: string, requestId?: string): Promise<void> {
    return this.unitOfWork.transaction(async transaction => {
      const existing = await this.lockTour(transaction, tourId);
      const deletedAt = new Date();
      await transaction
        .update(tours)
        .set({ deletedAt, isActive: false })
        .where(and(eq(tours.id, tourId), isNull(tours.deletedAt)));
      await transaction
        .update(tourGuideAssignments)
        .set({ deletedAt })
        .where(
          and(eq(tourGuideAssignments.tourId, tourId), isNull(tourGuideAssignments.deletedAt)),
        );
      await this.audit.record(transaction, {
        action: 'tour.changed',
        actor: { type: 'user', userId: actorId },
        before: { slug: existing.slug, status: existing.isActive ? 'active' : 'inactive' },
        after: { slug: existing.slug, status: 'deleted' },
        eventKey: randomUUID(),
        requestId,
        targetId: tourId,
        targetType: 'tour',
      });
    });
  }

  async operatorDetail(tourId: string) {
    const [tour] = await this.database
      .select(tourSelection)
      .from(tours)
      .where(and(eq(tours.id, tourId), isNull(tours.deletedAt)))
      .limit(1);
    if (!tour) throw new NotFoundException('Tour not found.');
    return this.present(tour, await this.loadGuides(this.database, tour.id), true);
  }

  async publicDetail(slug: string) {
    const [tour] = await this.database
      .select(tourSelection)
      .from(tours)
      .where(and(eq(tours.slug, slug), eq(tours.isActive, true), isNull(tours.deletedAt)))
      .limit(1);
    if (!tour) throw new NotFoundException('Tour not found.');
    return this.present(tour, await this.loadGuides(this.database, tour.id), false);
  }

  async publicList(query: ListToursQueryDto) {
    const conditions = this.listConditions(query);
    const sortColumn = {
      name: tours.name,
      price: tours.priceCents,
      durationDays: tours.durationDays,
      maximumGroupSize: tours.maximumGroupSize,
      difficulty: tours.difficulty,
      ratingAverage: tours.ratingAverage,
      createdAt: tours.createdAt,
    }[query.sortBy];
    const order = query.sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn);
    const rows = await this.database
      .select(tourSelection)
      .from(tours)
      .where(and(...conditions))
      .orderBy(order, asc(tours.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
    const [{ total = 0 } = {}] = await this.database
      .select({ total: count() })
      .from(tours)
      .where(and(...conditions));
    const guides = await this.loadGuideMap(rows.map(row => row.id));
    return {
      items: rows.map(row => this.present(row, guides.get(row.id) ?? [], false)),
      total,
    };
  }

  private createWithSlug(
    actorId: string,
    input: TourWriteInput,
    team: GuideTeamInput,
    slug: string,
    requestId?: string,
  ) {
    return this.unitOfWork.transaction(async transaction => {
      const [created] = await transaction
        .insert(tours)
        .values(this.writeValues(input, slug))
        .returning(tourSelection);
      if (!created) throw new Error('Tour insert did not return a row.');
      await this.replaceTeam(transaction, created.id, team);
      await this.audit.record(transaction, {
        action: 'tour.changed',
        actor: { type: 'user', userId: actorId },
        after: { slug, status: created.isActive ? 'active' : 'inactive' },
        eventKey: randomUUID(),
        requestId,
        targetId: created.id,
        targetType: 'tour',
      });
      await this.recordTeamAudit(transaction, actorId, created.id, team, requestId);
      return this.present(created, await this.loadGuides(transaction, created.id), true);
    });
  }

  private listConditions(query: ListToursQueryDto): SQL[] {
    const conditions: SQL[] = [eq(tours.isActive, true), isNull(tours.deletedAt)];
    if (query.search?.trim()) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        or(ilike(tours.name, pattern), ilike(tours.summary, pattern), ilike(tours.slug, pattern))!,
      );
    }
    if (query.difficulty) conditions.push(eq(tours.difficulty, query.difficulty));
    if (query.minPrice !== undefined) conditions.push(gte(tours.priceCents, query.minPrice));
    if (query.maxPrice !== undefined) conditions.push(lte(tours.priceCents, query.maxPrice));
    if (query.minDuration !== undefined)
      conditions.push(gte(tours.durationDays, query.minDuration));
    if (query.maxDuration !== undefined)
      conditions.push(lte(tours.durationDays, query.maxDuration));
    if (query.minGroupSize !== undefined)
      conditions.push(gte(tours.maximumGroupSize, query.minGroupSize));
    if (query.maxGroupSize !== undefined)
      conditions.push(lte(tours.maximumGroupSize, query.maxGroupSize));
    if (query.minRating !== undefined)
      conditions.push(gte(tours.ratingAverage, String(query.minRating)));
    if (query.maxRating !== undefined)
      conditions.push(lte(tours.ratingAverage, String(query.maxRating)));
    return conditions;
  }

  private async lockTour(transaction: DatabaseTransaction, tourId: string): Promise<TourRow> {
    const [tour] = await transaction
      .select()
      .from(tours)
      .where(and(eq(tours.id, tourId), isNull(tours.deletedAt)))
      .limit(1)
      .for('update');
    if (!tour) throw new NotFoundException('Tour not found.');
    return tour;
  }

  private async replaceTeam(
    transaction: DatabaseTransaction,
    tourId: string,
    team: GuideTeamInput,
  ): Promise<void> {
    const guideIds = [...new Set(team.guideIds)];
    if (guideIds.length !== team.guideIds.length || guideIds.includes(team.leadGuideId)) {
      throw new TourPolicyError('INVALID_GUIDE_TEAM', 'Guide team members must be unique.');
    }
    const teamUsers = await transaction
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(inArray(users.id, [team.leadGuideId, ...guideIds]))
      .for('update');
    const roles = new Map(teamUsers.map(user => [user.id, user.role]));
    if (
      roles.get(team.leadGuideId) !== 'lead-guide' ||
      guideIds.some(id => roles.get(id) !== 'guide')
    ) {
      throw new TourPolicyError(
        'GUIDE_ROLE_INCOMPATIBLE',
        'Every assigned user must have the compatible guide role.',
      );
    }
    await transaction
      .update(tourGuideAssignments)
      .set({ deletedAt: new Date() })
      .where(and(eq(tourGuideAssignments.tourId, tourId), isNull(tourGuideAssignments.deletedAt)));
    await transaction
      .insert(tourGuideAssignments)
      .values([
        { tourId, userId: team.leadGuideId, assignmentRole: 'lead-guide' },
        ...guideIds.map(userId => ({ tourId, userId, assignmentRole: 'guide' as const })),
      ]);
  }

  private loadGuides(database: Database | DatabaseTransaction, tourId: string) {
    return database
      .select({
        id: users.id,
        name: users.name,
        assignmentRole: tourGuideAssignments.assignmentRole,
      })
      .from(tourGuideAssignments)
      .innerJoin(users, eq(users.id, tourGuideAssignments.userId))
      .where(and(eq(tourGuideAssignments.tourId, tourId), isNull(tourGuideAssignments.deletedAt)))
      .orderBy(asc(tourGuideAssignments.assignmentRole), asc(users.id));
  }

  private async loadGuideMap(tourIds: string[]) {
    const map = new Map<string, Awaited<ReturnType<ToursService['loadGuides']>>>();
    if (tourIds.length === 0) return map;
    const rows = await this.database
      .select({
        tourId: tourGuideAssignments.tourId,
        id: users.id,
        name: users.name,
        assignmentRole: tourGuideAssignments.assignmentRole,
      })
      .from(tourGuideAssignments)
      .innerJoin(users, eq(users.id, tourGuideAssignments.userId))
      .where(
        and(inArray(tourGuideAssignments.tourId, tourIds), isNull(tourGuideAssignments.deletedAt)),
      )
      .orderBy(asc(users.id));
    for (const row of rows) {
      const current = map.get(row.tourId) ?? [];
      current.push({ id: row.id, name: row.name, assignmentRole: row.assignmentRole });
      map.set(row.tourId, current);
    }
    return map;
  }

  private present(
    row: TourProjection,
    guides: Array<{ id: string; name: string; assignmentRole: 'lead-guide' | 'guide' }>,
    operator: boolean,
  ) {
    const result = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      summary: row.summary,
      description: row.description,
      durationDays: row.durationDays,
      durationWeeks: Math.round((row.durationDays / 7) * 10) / 10,
      maximumGroupSize: row.maximumGroupSize,
      difficulty: row.difficulty,
      price: row.price,
      discountPercentage: row.discountPercentage === null ? null : Number(row.discountPercentage),
      ratingAverage: row.ratingAverage === null ? null : Number(row.ratingAverage),
      ratingCount: row.ratingCount,
      startLocation: {
        name: row.startLocationName,
        address: row.startLocationAddress,
        latitude: row.startLocationLatitude,
        longitude: row.startLocationLongitude,
      },
      isActive: row.isActive,
      guides: {
        lead: guides.find(guide => guide.assignmentRole === 'lead-guide') ?? null,
        supporting: guides
          .filter(guide => guide.assignmentRole === 'guide')
          .map(({ id, name }) => ({ id, name })),
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return operator ? { ...result, deletedAt: row.deletedAt } : result;
  }

  private writeValues(input: TourWriteInput, slug: string) {
    return {
      name: input.name.trim(),
      slug,
      summary: input.summary.trim(),
      description: input.description?.trim() || null,
      durationDays: input.durationDays,
      maximumGroupSize: input.maximumGroupSize,
      difficulty: input.difficulty,
      priceCents: input.price,
      discountPercentage:
        input.discountPercentage == null ? null : String(input.discountPercentage),
      startLocationName: input.startLocation.name.trim(),
      startLocationAddress: input.startLocation.address?.trim() || null,
      startLocationLatitude: input.startLocation.latitude,
      startLocationLongitude: input.startLocation.longitude,
      isActive: input.isActive ?? false,
    };
  }

  private patchValues(input: UpdateTourDto) {
    const values: Partial<TourRow> = {};
    if (input.name !== undefined) values.name = input.name.trim();
    if (input.summary !== undefined) values.summary = input.summary.trim();
    if (input.description !== undefined) values.description = input.description?.trim() || null;
    if (input.durationDays !== undefined) values.durationDays = input.durationDays;
    if (input.maximumGroupSize !== undefined) values.maximumGroupSize = input.maximumGroupSize;
    if (input.difficulty !== undefined) values.difficulty = input.difficulty;
    if (input.price !== undefined) values.priceCents = input.price;
    if (input.discountPercentage !== undefined) {
      values.discountPercentage =
        input.discountPercentage === null ? null : String(input.discountPercentage);
    }
    if (input.startLocation !== undefined) {
      values.startLocationName = input.startLocation.name.trim();
      values.startLocationAddress = input.startLocation.address?.trim() || null;
      values.startLocationLatitude = input.startLocation.latitude;
      values.startLocationLongitude = input.startLocation.longitude;
    }
    if (input.isActive !== undefined) values.isActive = input.isActive;
    return values;
  }

  private recordTeamAudit(
    transaction: DatabaseTransaction,
    actorId: string,
    tourId: string,
    team: GuideTeamInput,
    requestId?: string,
  ) {
    return this.audit.record(transaction, {
      action: 'tour.guide_team_replaced',
      actor: { type: 'user', userId: actorId },
      after: { guideIds: [team.leadGuideId, ...team.guideIds] },
      eventKey: randomUUID(),
      requestId,
      targetId: tourId,
      targetType: 'tour',
    });
  }
}

function isSlugConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if (
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    error.constraint === 'tours_slug_unique'
  ) {
    return true;
  }
  return 'cause' in error && isSlugConflict(error.cause);
}
