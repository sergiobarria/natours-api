import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import { DrizzleAuditRecorder } from '../audit/drizzle-audit-recorder.js';
import { AppConfigService } from '../config/app-config.service.js';
import { DATABASE } from '../database/database.constants.js';
import { DatabaseUnitOfWork } from '../database/database-unit-of-work.js';
import {
  bookingIdempotency,
  bookingPayments,
  bookingTravelers,
  bookings,
  paymentProviderEvents,
} from '../database/schema/bookings.js';
import { users } from '../database/schema/identity.js';
import { tourDepartures, tours } from '../database/schema/tours.js';
import type { Database, DatabaseTransaction } from '../database/database.types.js';
import type { AuthenticatedPrincipal } from '../identity/authentication.types.js';
import { DomainError } from '../http/errors/domain.error.js';
import {
  PAYMENT_GATEWAY,
  PaymentGatewayError,
  type PaymentEvent,
  type PaymentGateway,
} from '../payments/payment-gateway.js';
import type { CreateBookingDto, ListBookingsQueryDto } from './bookings.dto.js';

const publicBooking = {
  id: bookings.id,
  status: bookings.status,
  tourId: bookings.tourId,
  departureId: bookings.departureId,
  tourName: bookings.tourName,
  departureStartAt: bookings.departureStartAt,
  purchaserName: bookings.purchaserName,
  purchaserEmail: bookings.purchaserEmail,
  unitPriceCents: bookings.unitPriceCents,
  discountPercentage: bookings.discountPercentage,
  discountCents: bookings.discountCents,
  discountedUnitPriceCents: bookings.discountedUnitPriceCents,
  quantity: bookings.quantity,
  subtotalCents: bookings.subtotalCents,
  totalCents: bookings.totalCents,
  currency: bookings.currency,
  holdExpiresAt: bookings.holdExpiresAt,
  cancellationRequestedAt: bookings.cancellationRequestedAt,
  confirmedAt: bookings.confirmedAt,
  cancelledAt: bookings.cancelledAt,
  createdAt: bookings.createdAt,
  updatedAt: bookings.updatedAt,
};

@Injectable()
export class BookingsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(DatabaseUnitOfWork) private readonly uow: DatabaseUnitOfWork,
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(DrizzleAuditRecorder) private readonly audit: DrizzleAuditRecorder,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async create(
    principal: AuthenticatedPrincipal,
    key: string,
    input: CreateBookingDto,
    requestId?: string,
  ) {
    if (!principal.emailVerified)
      throw new ForbiddenException('Email verification is required to book.');
    requireKey(key);
    const normalized = {
      departureId: input.departureId,
      travelers: input.travelers.map(t => ({
        fullName: t.fullName.trim(),
        email: t.email.trim().toLowerCase(),
        phone: t.phone.trim(),
      })),
    };
    const keyHash = hash(key);
    const requestHash = hash(JSON.stringify(normalized));
    const bookingId = await this.uow.transaction(async tx => {
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, principal.userId))
        .for('update');
      const [replay] = await tx
        .select()
        .from(bookingIdempotency)
        .where(
          and(
            eq(bookingIdempotency.userId, principal.userId),
            eq(bookingIdempotency.keyHash, keyHash),
          ),
        )
        .limit(1);
      if (replay) {
        if (replay.requestHash !== requestHash)
          throw new ConflictException('Idempotency-Key was already used with a different request.');
        return replay.bookingId;
      }
      const [source] = await tx
        .select({
          departureId: tourDepartures.id,
          departureStartAt: tourDepartures.startAt,
          available: tourDepartures.availableSpots,
          tourId: tours.id,
          tourName: tours.name,
          price: tours.priceCents,
          discount: tours.discountPercentage,
          maximum: tours.maximumGroupSize,
          purchaserName: users.name,
          purchaserEmail: users.email,
        })
        .from(tourDepartures)
        .innerJoin(tours, eq(tourDepartures.tourId, tours.id))
        .innerJoin(users, eq(users.id, principal.userId))
        .where(
          and(
            eq(tourDepartures.id, normalized.departureId),
            eq(tourDepartures.isActive, true),
            isNull(tourDepartures.deletedAt),
            gt(tourDepartures.startAt, new Date()),
            eq(tours.isActive, true),
            isNull(tours.deletedAt),
          ),
        )
        .for('update')
        .limit(1);
      if (!source) throw new NotFoundException('Departure not found.');
      const quantity = normalized.travelers.length;
      if (quantity > source.maximum || quantity > source.available)
        throw new ConflictException('The departure does not have enough available spots.');
      const pricing = calculateBookingPrice(source.price, source.discount, quantity);
      const { discountCents, discountedUnitPriceCents: discounted, totalCents: total } = pricing;
      const id = randomUUID();
      const now = new Date();
      const free = total === 0;
      const expiry = free
        ? null
        : new Date(now.getTime() + this.config.stripeCheckoutHoldMinutes * 60_000);
      await tx
        .update(tourDepartures)
        .set({
          availableSpots: sql`${tourDepartures.availableSpots} - ${quantity}`,
          reservedSpots: sql`${tourDepartures.reservedSpots} + ${quantity}`,
          updatedAt: now,
        })
        .where(eq(tourDepartures.id, source.departureId));
      await tx.insert(bookings).values({
        id,
        userId: principal.userId,
        tourId: source.tourId,
        departureId: source.departureId,
        status: free ? 'confirmed' : 'pending_payment',
        purchaserName: source.purchaserName,
        purchaserEmail: source.purchaserEmail,
        tourName: source.tourName,
        departureStartAt: source.departureStartAt,
        unitPriceCents: source.price,
        discountPercentage: source.discount,
        discountCents,
        discountedUnitPriceCents: discounted,
        quantity,
        subtotalCents: source.price * quantity,
        totalCents: total,
        currency: 'usd',
        holdExpiresAt: expiry,
        confirmedAt: free ? now : null,
      });
      await tx.insert(bookingTravelers).values(
        normalized.travelers.map((traveler, position) => ({
          bookingId: id,
          position,
          ...traveler,
        })),
      );
      if (!free)
        await tx.insert(bookingPayments).values({
          id: randomUUID(),
          bookingId: id,
          provider: this.config.paymentProvider,
          status: 'checkout_pending',
          amountCents: total,
          currency: 'usd',
          providerIdempotencyKey: `booking:${id}:checkout`,
        });
      await tx
        .insert(bookingIdempotency)
        .values({ userId: principal.userId, keyHash, requestHash, bookingId: id });
      await this.record(
        tx,
        { type: 'user', userId: principal.userId },
        id,
        free ? 'confirmed' : 'pending_payment',
        requestId,
        { quantity, totalCents: total },
      );
      return id;
    });
    return this.openCheckout(principal.userId, bookingId);
  }

  requireVerified(principal: AuthenticatedPrincipal): void {
    if (!principal.emailVerified) {
      throw new ForbiddenException('Email verification is required for bookings.');
    }
  }

  async list(userId: string, query: ListBookingsQueryDto) {
    const [{ total }] = await this.database
      .select({ total: count() })
      .from(bookings)
      .where(eq(bookings.userId, userId));
    const items = await this.database
      .select(publicBooking)
      .from(bookings)
      .where(eq(bookings.userId, userId))
      .orderBy(desc(bookings.createdAt), desc(bookings.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
    return { items, total };
  }
  async detail(userId: string, id: string) {
    const row = await this.owned(this.database, userId, id);
    const travelers = await this.database
      .select({
        fullName: bookingTravelers.fullName,
        email: bookingTravelers.email,
        phone: bookingTravelers.phone,
      })
      .from(bookingTravelers)
      .where(eq(bookingTravelers.bookingId, id))
      .orderBy(bookingTravelers.position);
    const [payment] = await this.database
      .select({ status: bookingPayments.status, checkoutUrl: bookingPayments.checkoutUrl })
      .from(bookingPayments)
      .where(eq(bookingPayments.bookingId, id))
      .limit(1);
    return { ...row, travelers, payment: payment ?? null };
  }

  async cancel(userId: string, id: string, requestId?: string) {
    const paid = await this.uow.transaction(async tx => {
      const row = await this.lockOwned(tx, userId, id);
      const now = new Date();
      if (row.status === 'cancelled') return false;
      if (['cancellation_pending', 'cancellation_failed'].includes(row.status)) return true;
      if (row.status !== 'confirmed')
        throw new ConflictException('Only confirmed bookings can be cancelled.');
      if (
        now.getTime() >
        row.departureStartAt.getTime() - this.config.bookingCancellationCutoffHours * 3_600_000
      )
        throw new ConflictException('The cancellation cutoff has passed.');
      if (row.totalCents === 0) {
        await this.release(tx, row, 'cancelled', now);
        await this.record(tx, { type: 'user', userId }, id, 'cancelled', requestId);
        return false;
      }
      await tx
        .update(bookings)
        .set({ status: 'cancellation_pending', cancellationRequestedAt: now, updatedAt: now })
        .where(eq(bookings.id, id));
      await tx
        .update(bookingPayments)
        .set({ status: 'refund_pending', updatedAt: now })
        .where(eq(bookingPayments.bookingId, id));
      await this.record(tx, { type: 'user', userId }, id, 'cancellation_pending', requestId);
      return true;
    });
    if (paid) await this.refund(id);
    return this.detail(userId, id);
  }

  async processEvent(event: PaymentEvent) {
    await this.uow.transaction(async tx => {
      const inserted = await tx
        .insert(paymentProviderEvents)
        .values({
          provider: this.config.paymentProvider,
          providerEventId: event.id,
          eventType: event.type,
          bookingId: event.bookingId,
        })
        .onConflictDoNothing()
        .returning({ id: paymentProviderEvents.id });
      if (!inserted.length) return;
      const [row] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, event.bookingId))
        .for('update')
        .limit(1);
      const [payment] = await tx
        .select()
        .from(bookingPayments)
        .where(
          and(
            eq(bookingPayments.id, event.paymentRecordId),
            eq(bookingPayments.bookingId, event.bookingId),
          ),
        )
        .limit(1);
      if (!row || !payment) throw new ConflictException('Payment event does not match a booking.');
      const now = new Date();
      if (event.type === 'checkout.completed') {
        if (row.status !== 'pending_payment') return;
        if (
          !event.paid ||
          event.checkoutId !== payment.providerCheckoutId ||
          event.amountCents !== row.totalCents ||
          event.currency !== row.currency
        )
          throw new ConflictException('Payment event details do not match the booking.');
        await tx
          .update(bookings)
          .set({ status: 'confirmed', confirmedAt: now, updatedAt: now })
          .where(eq(bookings.id, row.id));
        await tx
          .update(bookingPayments)
          .set({ status: 'paid', providerPaymentId: event.paymentId, updatedAt: now })
          .where(eq(bookingPayments.id, payment.id));
      } else if (event.type === 'checkout.expired') {
        if (row.status !== 'pending_payment' || event.checkoutId !== payment.providerCheckoutId)
          return;
        await this.release(tx, row, 'expired', now);
      } else {
        if (!['cancellation_pending', 'cancellation_failed'].includes(row.status)) return;
        if (
          event.paymentId !== payment.providerPaymentId ||
          event.amountRefundedCents !== row.totalCents ||
          event.currency !== row.currency
        )
          throw new ConflictException('Refund event details do not match the booking.');
        await this.release(tx, row, 'cancelled', now);
        await tx
          .update(bookingPayments)
          .set({
            status: 'refunded',
            providerRefundId: event.refundId ?? payment.providerRefundId,
            updatedAt: now,
          })
          .where(eq(bookingPayments.id, payment.id));
      }
      await this.record(tx, { type: 'system', name: 'payment-webhook' }, row.id, event.type);
    });
  }

  async expireDue(limit = 100) {
    const due = await this.database
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.status, 'pending_payment'), lte(bookings.holdExpiresAt, new Date())))
      .limit(limit);
    let changed = 0;
    for (const item of due)
      changed += await this.uow.transaction(async tx => {
        const [row] = await tx
          .select()
          .from(bookings)
          .where(eq(bookings.id, item.id))
          .for('update')
          .limit(1);
        if (
          !row ||
          row.status !== 'pending_payment' ||
          !row.holdExpiresAt ||
          row.holdExpiresAt > new Date()
        )
          return 0;
        await this.release(tx, row, 'expired', new Date());
        await this.record(tx, { type: 'system', name: 'booking-expiration' }, row.id, 'expired');
        return 1;
      });
    return { inspected: due.length, changed };
  }
  async inspectDueHolds() {
    const [{ value }] = await this.database
      .select({ value: count() })
      .from(bookings)
      .where(and(eq(bookings.status, 'pending_payment'), lte(bookings.holdExpiresAt, new Date())));
    return value;
  }
  async inspectUnresolvedRefunds() {
    const [{ value }] = await this.database
      .select({ value: count() })
      .from(bookings)
      .innerJoin(bookingPayments, eq(bookingPayments.bookingId, bookings.id))
      .where(
        and(
          sql`${bookings.status} IN ('cancellation_pending','cancellation_failed')`,
          sql`${bookingPayments.status} IN ('refund_pending','refund_failed')`,
        ),
      );
    return value;
  }

  async recoverCheckouts(limit = 25) {
    const rows = await this.database
      .select({ bookingId: bookings.id, userId: bookings.userId })
      .from(bookings)
      .innerJoin(bookingPayments, eq(bookingPayments.bookingId, bookings.id))
      .where(
        and(
          eq(bookings.status, 'pending_payment'),
          eq(bookingPayments.status, 'checkout_pending'),
          gt(bookings.holdExpiresAt, new Date()),
        ),
      )
      .limit(limit);
    let changed = 0;
    for (const row of rows) {
      try {
        await this.openCheckout(row.userId, row.bookingId);
        changed++;
      } catch {
        /* retained for the next bounded retry */
      }
    }
    return { inspected: rows.length, changed };
  }

  async reconcileRefunds(limit = 100) {
    const rows = await this.database
      .select({ bookingId: bookings.id, refundId: bookingPayments.providerRefundId })
      .from(bookings)
      .innerJoin(bookingPayments, eq(bookingPayments.bookingId, bookings.id))
      .where(
        and(
          sql`${bookings.status} IN ('cancellation_pending','cancellation_failed')`,
          sql`${bookingPayments.status} IN ('refund_pending','refund_failed')`,
        ),
      )
      .limit(limit);
    let changed = 0;
    for (const row of rows) {
      if (!row.refundId) {
        await this.refund(row.bookingId);
        continue;
      }
      try {
        const refund = await this.gateway.inspectRefund(row.refundId);
        if (refund.status === 'succeeded') {
          await this.finalizeRefund(row.bookingId, row.refundId, refund.amountCents);
          changed++;
        } else if (refund.status === 'failed')
          await this.database
            .update(bookingPayments)
            .set({ status: 'refund_failed', updatedAt: new Date() })
            .where(eq(bookingPayments.bookingId, row.bookingId));
      } catch {
        /* retain explicit recovery state */
      }
    }
    return { inspected: rows.length, changed };
  }

  private async openCheckout(userId: string, bookingId: string) {
    const row = await this.owned(this.database, userId, bookingId);
    if (row.totalCents === 0) return this.detail(userId, bookingId);
    const [payment] = await this.database
      .select()
      .from(bookingPayments)
      .where(eq(bookingPayments.bookingId, bookingId))
      .limit(1);
    if (payment.status === 'checkout_open' && payment.checkoutUrl)
      return this.detail(userId, bookingId);
    try {
      const result = await this.gateway.createCheckout({
        bookingId,
        paymentId: payment.id,
        amountCents: row.totalCents,
        currency: 'usd',
        description: row.tourName,
        quantity: row.quantity,
        expiresAt: row.holdExpiresAt!,
        idempotencyKey: payment.providerIdempotencyKey,
        successUrl: `${this.config.frontendUrl}/bookings/${bookingId}?checkout=success`,
        cancelUrl: `${this.config.frontendUrl}/bookings/${bookingId}?checkout=cancelled`,
      });
      await this.database
        .update(bookingPayments)
        .set({
          status: 'checkout_open',
          providerCheckoutId: result.checkoutId,
          providerPaymentId: result.paymentId,
          checkoutUrl: result.url,
          lastErrorCode: null,
          updatedAt: new Date(),
        })
        .where(eq(bookingPayments.id, payment.id));
      return this.detail(userId, bookingId);
    } catch (error) {
      await this.database
        .update(bookingPayments)
        .set({
          lastErrorCode: error instanceof PaymentGatewayError ? error.code : 'provider_failure',
          updatedAt: new Date(),
        })
        .where(eq(bookingPayments.id, payment.id));
      throw new DomainError({
        code: 'PAYMENT_PROVIDER_UNAVAILABLE',
        status: 503,
        message:
          'Payment checkout is temporarily unavailable; retry with the same Idempotency-Key.',
      });
    }
  }
  private async refund(bookingId: string) {
    const [payment] = await this.database
      .select()
      .from(bookingPayments)
      .where(eq(bookingPayments.bookingId, bookingId))
      .limit(1);
    if (!payment?.providerPaymentId) return;
    try {
      const result = await this.gateway.requestFullRefund({
        bookingId,
        paymentRecordId: payment.id,
        paymentId: payment.providerPaymentId,
        amountCents: payment.amountCents,
        idempotencyKey: `booking:${bookingId}:refund`,
      });
      await this.database
        .update(bookingPayments)
        .set({
          providerRefundId: result.refundId,
          status:
            result.status === 'failed'
              ? 'refund_failed'
              : result.status === 'succeeded'
                ? 'refunded'
                : 'refund_pending',
          updatedAt: new Date(),
        })
        .where(eq(bookingPayments.id, payment.id));
      if (result.status === 'succeeded') {
        await this.finalizeRefund(bookingId, result.refundId, payment.amountCents);
      }
    } catch (error) {
      await this.database
        .update(bookingPayments)
        .set({
          status: 'refund_failed',
          lastErrorCode: error instanceof PaymentGatewayError ? error.code : 'provider_failure',
          updatedAt: new Date(),
        })
        .where(eq(bookingPayments.id, payment.id));
      await this.database
        .update(bookings)
        .set({ status: 'cancellation_failed', updatedAt: new Date() })
        .where(eq(bookings.id, bookingId));
    }
  }
  private async finalizeRefund(bookingId: string, refundId: string, amount: number) {
    await this.uow.transaction(async tx => {
      const [row] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .for('update')
        .limit(1);
      const [payment] = await tx
        .select()
        .from(bookingPayments)
        .where(eq(bookingPayments.bookingId, bookingId))
        .limit(1);
      if (!row || !payment || row.status === 'cancelled') return;
      if (amount !== row.totalCents)
        throw new ConflictException('Refund amount does not match the booking.');
      await this.release(tx, row, 'cancelled', new Date());
      await tx
        .update(bookingPayments)
        .set({ status: 'refunded', providerRefundId: refundId, updatedAt: new Date() })
        .where(eq(bookingPayments.id, payment.id));
      await this.record(
        tx,
        { type: 'system', name: 'refund-reconciliation' },
        bookingId,
        'cancelled',
      );
    });
  }
  private async release(
    tx: DatabaseTransaction,
    row: typeof bookings.$inferSelect,
    status: 'expired' | 'cancelled',
    now: Date,
  ) {
    if (row.inventoryReleasedAt) return;
    const [departure] = await tx
      .select()
      .from(tourDepartures)
      .where(eq(tourDepartures.id, row.departureId))
      .for('update')
      .limit(1);
    if (!departure || departure.reservedSpots < row.quantity)
      throw new ConflictException('Booking inventory is inconsistent.');
    await tx
      .update(tourDepartures)
      .set({
        availableSpots: sql`${tourDepartures.availableSpots} + ${row.quantity}`,
        reservedSpots: sql`${tourDepartures.reservedSpots} - ${row.quantity}`,
        updatedAt: now,
      })
      .where(eq(tourDepartures.id, row.departureId));
    await tx
      .update(bookings)
      .set({
        status,
        inventoryReleasedAt: now,
        cancelledAt: status === 'cancelled' ? now : null,
        updatedAt: now,
      })
      .where(eq(bookings.id, row.id));
  }
  private async owned(db: Database | DatabaseTransaction, userId: string, id: string) {
    const [row] = await db
      .select(publicBooking)
      .from(bookings)
      .where(and(eq(bookings.id, id), eq(bookings.userId, userId)))
      .limit(1);
    if (!row) throw new NotFoundException('Booking not found.');
    return row;
  }
  private async lockOwned(tx: DatabaseTransaction, userId: string, id: string) {
    const [row] = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, id), eq(bookings.userId, userId)))
      .for('update')
      .limit(1);
    if (!row) throw new NotFoundException('Booking not found.');
    return row;
  }
  private record(
    tx: DatabaseTransaction,
    actor: { type: 'user'; userId: string } | { type: 'system'; name: string },
    id: string,
    status: string,
    requestId?: string,
    more: Record<string, unknown> = {},
  ) {
    return this.audit.record(tx, {
      action: 'booking.changed',
      actor,
      after: { status, ...more },
      eventKey: randomUUID(),
      requestId,
      targetId: id,
      targetType: 'booking',
    });
  }
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
function requireKey(value: string) {
  if (!/^[\x21-\x7e]{1,255}$/.test(value))
    throw new BadRequestException('A valid Idempotency-Key header is required.');
}

export function calculateBookingPrice(
  unitPriceCents: number,
  discountPercentage: string | null,
  quantity: number,
) {
  const percentage = discountPercentage === null ? 0 : Number(discountPercentage);
  const discountCents = Math.round((unitPriceCents * percentage) / 100);
  const discountedUnitPriceCents = unitPriceCents - discountCents;
  return {
    discountCents,
    discountedUnitPriceCents,
    subtotalCents: unitPriceCents * quantity,
    totalCents: discountedUnitPriceCents * quantity,
  };
}
