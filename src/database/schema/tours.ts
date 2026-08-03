import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity.js';
import { databaseObjectName } from './names.js';
import { softDeletionColumn, timestampColumns, uuidPrimaryKey } from './primitives.js';

export const TOUR_DIFFICULTIES = ['easy', 'moderate', 'difficult'] as const;
export type TourDifficulty = (typeof TOUR_DIFFICULTIES)[number];
export const GUIDE_ASSIGNMENT_ROLES = ['lead-guide', 'guide'] as const;
export type GuideAssignmentRole = (typeof GUIDE_ASSIGNMENT_ROLES)[number];

export const tours = pgTable(
  'tours',
  {
    id: uuidPrimaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    summary: text('summary').notNull(),
    description: text('description'),
    durationDays: integer('duration_days').notNull(),
    maximumGroupSize: integer('maximum_group_size').notNull(),
    difficulty: text('difficulty').$type<TourDifficulty>().notNull(),
    priceCents: integer('price_cents').notNull(),
    discountPercentage: numeric('discount_percentage', { precision: 5, scale: 2 }),
    ratingAverage: numeric('rating_average', { precision: 3, scale: 2 }),
    ratingCount: integer('rating_count').notNull().default(0),
    startLocationName: text('start_location_name').notNull(),
    startLocationAddress: text('start_location_address'),
    startLocationLatitude: doublePrecision('start_location_latitude').notNull(),
    startLocationLongitude: doublePrecision('start_location_longitude').notNull(),
    isActive: boolean('is_active').notNull().default(false),
    ...timestampColumns(),
    deletedAt: softDeletionColumn(),
  },
  table => [
    uniqueIndex(databaseObjectName('tours', 'slug', 'unique')).on(table.slug),
    index(databaseObjectName('tours', ['is_active', 'deleted_at', 'id'], 'idx')).on(
      table.isActive,
      table.deletedAt,
      table.id,
    ),
    index(databaseObjectName('tours', ['price_cents', 'id'], 'idx')).on(table.priceCents, table.id),
    index(databaseObjectName('tours', ['rating_average', 'id'], 'idx')).on(
      table.ratingAverage,
      table.id,
    ),
    check(databaseObjectName('tours', 'name', 'check'), sql`length(btrim(${table.name})) > 0`),
    check(
      databaseObjectName('tours', 'summary', 'check'),
      sql`length(btrim(${table.summary})) > 0`,
    ),
    check(databaseObjectName('tours', 'duration_days', 'check'), sql`${table.durationDays} > 0`),
    check(
      databaseObjectName('tours', 'maximum_group_size', 'check'),
      sql`${table.maximumGroupSize} > 0`,
    ),
    check(
      databaseObjectName('tours', 'difficulty', 'check'),
      sql`${table.difficulty} IN ('easy', 'moderate', 'difficult')`,
    ),
    check(databaseObjectName('tours', 'price_cents', 'check'), sql`${table.priceCents} >= 0`),
    check(
      databaseObjectName('tours', 'discount_percentage', 'check'),
      sql`${table.discountPercentage} IS NULL OR (${table.discountPercentage} > 0 AND ${table.discountPercentage} < 100)`,
    ),
    check(databaseObjectName('tours', 'rating_count', 'check'), sql`${table.ratingCount} >= 0`),
    check(
      databaseObjectName('tours', 'rating_aggregate', 'check'),
      sql`(${table.ratingCount} = 0 AND ${table.ratingAverage} IS NULL) OR (${table.ratingCount} > 0 AND ${table.ratingAverage} BETWEEN 1 AND 5)`,
    ),
    check(
      databaseObjectName('tours', 'start_location_latitude', 'check'),
      sql`${table.startLocationLatitude} BETWEEN -90 AND 90`,
    ),
    check(
      databaseObjectName('tours', 'start_location_longitude', 'check'),
      sql`${table.startLocationLongitude} BETWEEN -180 AND 180`,
    ),
  ],
);

export const tourGuideAssignments = pgTable(
  'tour_guide_assignments',
  {
    id: uuidPrimaryKey(),
    tourId: uuid('tour_id')
      .notNull()
      .references(() => tours.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    assignmentRole: text('assignment_role').$type<GuideAssignmentRole>().notNull(),
    ...timestampColumns(),
    deletedAt: softDeletionColumn(),
  },
  table => [
    uniqueIndex(databaseObjectName('tour_guide_assignments', ['tour_id', 'user_id'], 'unique'))
      .on(table.tourId, table.userId)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex(databaseObjectName('tour_guide_assignments', 'active_lead', 'unique'))
      .on(table.tourId)
      .where(sql`${table.assignmentRole} = 'lead-guide' AND ${table.deletedAt} IS NULL`),
    index(databaseObjectName('tour_guide_assignments', ['user_id', 'deleted_at'], 'idx')).on(
      table.userId,
      table.deletedAt,
    ),
    index(databaseObjectName('tour_guide_assignments', ['tour_id', 'assignment_role'], 'idx')).on(
      table.tourId,
      table.assignmentRole,
    ),
    check(
      databaseObjectName('tour_guide_assignments', 'assignment_role', 'check'),
      sql`${table.assignmentRole} IN ('lead-guide', 'guide')`,
    ),
  ],
);
