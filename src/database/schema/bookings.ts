import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity.js';
import { databaseObjectName } from './names.js';
import {
  moneyInCents,
  nonNegativeMoneyCheck,
  timestampColumns,
  uuidPrimaryKey,
} from './primitives.js';
import { tourDepartures, tours } from './tours.js';

export const BOOKING_STATUSES = [
  'pending_payment',
  'confirmed',
  'cancellation_pending',
  'cancellation_failed',
  'cancelled',
  'expired',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'checkout_pending',
  'checkout_open',
  'paid',
  'refund_pending',
  'refund_failed',
  'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const bookings = pgTable(
  'bookings',
  {
    id: uuidPrimaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    tourId: uuid('tour_id')
      .notNull()
      .references(() => tours.id, { onDelete: 'restrict' }),
    departureId: uuid('departure_id')
      .notNull()
      .references(() => tourDepartures.id, { onDelete: 'restrict' }),
    status: text('status').$type<BookingStatus>().notNull(),
    purchaserName: text('purchaser_name').notNull(),
    purchaserEmail: text('purchaser_email').notNull(),
    tourName: text('tour_name').notNull(),
    departureStartAt: timestamp('departure_start_at', {
      mode: 'date',
      precision: 3,
      withTimezone: true,
    }).notNull(),
    unitPriceCents: moneyInCents('unit_price_cents'),
    discountPercentage: text('discount_percentage'),
    discountCents: moneyInCents('discount_cents'),
    discountedUnitPriceCents: moneyInCents('discounted_unit_price_cents'),
    quantity: integer('quantity').notNull(),
    subtotalCents: moneyInCents('subtotal_cents'),
    totalCents: moneyInCents('total_cents'),
    currency: text('currency').notNull().default('usd'),
    holdExpiresAt: timestamp('hold_expires_at', { mode: 'date', precision: 3, withTimezone: true }),
    cancellationRequestedAt: timestamp('cancellation_requested_at', {
      mode: 'date',
      precision: 3,
      withTimezone: true,
    }),
    confirmedAt: timestamp('confirmed_at', { mode: 'date', precision: 3, withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { mode: 'date', precision: 3, withTimezone: true }),
    inventoryReleasedAt: timestamp('inventory_released_at', {
      mode: 'date',
      precision: 3,
      withTimezone: true,
    }),
    ...timestampColumns(),
  },
  table => [
    check(
      databaseObjectName('bookings', 'status', 'check'),
      sql`${table.status} IN ('pending_payment','confirmed','cancellation_pending','cancellation_failed','cancelled','expired')`,
    ),
    check(databaseObjectName('bookings', 'quantity', 'check'), sql`${table.quantity} > 0`),
    check(databaseObjectName('bookings', 'currency', 'check'), sql`${table.currency} = 'usd'`),
    nonNegativeMoneyCheck('bookings', table.unitPriceCents),
    nonNegativeMoneyCheck('bookings', table.discountCents),
    nonNegativeMoneyCheck('bookings', table.discountedUnitPriceCents),
    nonNegativeMoneyCheck('bookings', table.subtotalCents),
    nonNegativeMoneyCheck('bookings', table.totalCents),
    index(databaseObjectName('bookings', ['user_id', 'created_at'], 'idx')).on(
      table.userId,
      table.createdAt,
      table.id,
    ),
    index(databaseObjectName('bookings', ['status', 'hold_expires_at'], 'idx')).on(
      table.status,
      table.holdExpiresAt,
    ),
    index(databaseObjectName('bookings', ['status', 'departure_start_at', 'tour_id'], 'idx')).on(
      table.status,
      table.departureStartAt,
      table.tourId,
    ),
  ],
);

export const bookingTravelers = pgTable(
  'booking_travelers',
  {
    id: uuidPrimaryKey(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    ...timestampColumns(),
  },
  table => [
    uniqueIndex(databaseObjectName('booking_travelers', ['booking_id', 'position'], 'unique')).on(
      table.bookingId,
      table.position,
    ),
    check(
      databaseObjectName('booking_travelers', 'position', 'check'),
      sql`${table.position} >= 0`,
    ),
  ],
);

export const bookingPayments = pgTable(
  'booking_payments',
  {
    id: uuidPrimaryKey(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'restrict' }),
    provider: text('provider').notNull(),
    status: text('status').$type<PaymentStatus>().notNull(),
    amountCents: moneyInCents('amount_cents'),
    currency: text('currency').notNull().default('usd'),
    providerIdempotencyKey: text('provider_idempotency_key').notNull(),
    providerCheckoutId: text('provider_checkout_id'),
    providerPaymentId: text('provider_payment_id'),
    providerRefundId: text('provider_refund_id'),
    checkoutUrl: text('checkout_url'),
    lastErrorCode: text('last_error_code'),
    ...timestampColumns(),
  },
  table => [
    uniqueIndex(databaseObjectName('booking_payments', 'booking_id', 'unique')).on(table.bookingId),
    uniqueIndex(databaseObjectName('booking_payments', 'provider_idempotency_key', 'unique')).on(
      table.providerIdempotencyKey,
    ),
    uniqueIndex(databaseObjectName('booking_payments', 'provider_checkout_id', 'unique')).on(
      table.providerCheckoutId,
    ),
    uniqueIndex(databaseObjectName('booking_payments', 'provider_payment_id', 'unique')).on(
      table.providerPaymentId,
    ),
    uniqueIndex(databaseObjectName('booking_payments', 'provider_refund_id', 'unique')).on(
      table.providerRefundId,
    ),
    check(
      databaseObjectName('booking_payments', 'status', 'check'),
      sql`${table.status} IN ('checkout_pending','checkout_open','paid','refund_pending','refund_failed','refunded')`,
    ),
    nonNegativeMoneyCheck('booking_payments', table.amountCents),
    index(databaseObjectName('booking_payments', ['status', 'updated_at'], 'idx')).on(
      table.status,
      table.updatedAt,
    ),
  ],
);

export const bookingIdempotency = pgTable(
  'booking_idempotency',
  {
    id: uuidPrimaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    keyHash: text('key_hash').notNull(),
    requestHash: text('request_hash').notNull(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'restrict' }),
    ...timestampColumns(),
  },
  table => [
    uniqueIndex(databaseObjectName('booking_idempotency', ['user_id', 'key_hash'], 'unique')).on(
      table.userId,
      table.keyHash,
    ),
  ],
);

export const paymentProviderEvents = pgTable(
  'payment_provider_events',
  {
    id: uuidPrimaryKey(),
    provider: text('provider').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    eventType: text('event_type').notNull(),
    bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'restrict' }),
    processedAt: timestamp('processed_at', { mode: 'date', precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    uniqueIndex(
      databaseObjectName('payment_provider_events', ['provider', 'provider_event_id'], 'unique'),
    ).on(table.provider, table.providerEventId),
    index(databaseObjectName('payment_provider_events', 'booking_id', 'idx')).on(table.bookingId),
  ],
);
