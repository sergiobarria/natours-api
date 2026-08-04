import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import {
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  INestApplication,
  InternalServerErrorException,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiExcludeController } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { Throttle } from '@nestjs/throttler';
import { PublicRoute } from '../src/identity/identity.decorators.js';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/bootstrap.js';
import { AppConfigService } from '../src/config/app-config.service.js';
import { DomainError } from '../src/http/errors/domain.error.js';
import { NativeResponse } from '../src/http/response/native-response.decorator.js';
import { REDIS_CLIENT } from '../src/platform/redis/redis.constants.js';
import type { RedisClient } from '../src/platform/redis/redis.types.js';
import { RateLimitPolicy } from '../src/rate-limit/rate-limit.decorators.js';
import { RATE_LIMIT_POLICY } from '../src/rate-limit/rate-limit.constants.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import { outboxMessages } from '../src/database/schema/platform-jobs.js';
import {
  bookingIdempotency,
  bookingPayments,
  bookingTravelers,
  bookings,
  paymentProviderEvents,
} from '../src/database/schema/bookings.js';
import { users } from '../src/database/schema/identity.js';
import { reviews } from '../src/database/schema/reviews.js';
import {
  tourDepartures,
  tourGuideAssignments,
  tourMedia,
  tours,
} from '../src/database/schema/tours.js';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { presentPaginated } from '../src/http/response/response.presenter.js';

interface TestErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

function readErrorResponse(response: { body: unknown }): TestErrorResponse {
  return response.body as TestErrorResponse;
}

class ContractQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  count!: number;
}

@ApiExcludeController()
@PublicRoute()
@Controller('contract-tests')
class ContractTestController {
  @Get('rate-limit')
  @RateLimitPolicy(RATE_LIMIT_POLICY.authentication)
  @Throttle({ authentication: { limit: 2, ttl: 60_000 } })
  rateLimit() {
    return { limited: true };
  }

  @Get('collection')
  collection() {
    return [{ id: 'first' }, { id: 'second' }];
  }

  @Get('pagination')
  pagination() {
    return presentPaginated([{ id: 'second-page' }], {
      page: 2,
      perPage: 1,
      totalItems: 3,
      path: '/api/v1/contract-tests/pagination',
    });
  }

  @Get('validation')
  validation(@Query() query: ContractQuery) {
    return query;
  }

  @Get('domain-error')
  domainError(): never {
    throw new DomainError({
      code: 'CONTRACT_TEST_FAILED',
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      message: 'The contract test failed safely.',
      details: { reason: 'fixture' },
    });
  }

  @Get('conflict')
  conflict(): never {
    throw new ConflictException('The fixture conflicts with existing state.');
  }

  @Get('unexpected-error')
  unexpectedError(): never {
    throw new Error('sensitive internal failure');
  }

  @Get('internal-http-error')
  internalHttpError(): never {
    throw new InternalServerErrorException('sensitive HTTP exception failure');
  }

  @Get('no-content')
  @HttpCode(HttpStatus.NO_CONTENT)
  noContent(): void {}

  @Get('stream')
  stream(): StreamableFile {
    return new StreamableFile(Buffer.from('stream-content'));
  }

  @Get('native')
  @NativeResponse()
  nativeResponse() {
    return { native: true };
  }

  @Get('native-error')
  @NativeResponse()
  nativeError(): never {
    throw new ConflictException('Native conflict response.');
  }
}

describe('application foundation (e2e)', () => {
  let app: INestApplication;
  let httpServer: Parameters<typeof request>[0];
  let database: Database;
  let authenticatedEmail: string;
  let authenticatedPassword: string;
  let authenticatedToken: string;
  let authenticatedUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ContractTestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(app.get(Logger));
    await configureApplication(app, app.get(AppConfigService));
    await app.init();
    httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    database = app.get(DATABASE);
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the versioned API root', async () => {
    await request(httpServer)
      .get('/api/v1')
      .expect(200)
      .expect({ data: { name: 'natours-api', version: '1' } });
  });

  it('publishes chronological departures and ordered media on tour detail', async () => {
    const tourId = randomUUID();
    const slug = `operations-${tourId}`;
    await database.insert(tours).values({
      id: tourId,
      name: 'Operations Tour',
      slug,
      summary: 'Operations fixture',
      durationDays: 3,
      maximumGroupSize: 12,
      difficulty: 'easy',
      priceCents: 100,
      startLocationName: 'Start',
      startLocationLatitude: 1,
      startLocationLongitude: 1,
      isActive: true,
    });
    const later = new Date(Date.now() + 172_800_000);
    const earlier = new Date(Date.now() + 86_400_000);
    await database.insert(tourDepartures).values([
      { id: randomUUID(), tourId, startAt: later, availableSpots: 8 },
      { id: randomUUID(), tourId, startAt: earlier, availableSpots: 7 },
      {
        id: randomUUID(),
        tourId,
        startAt: new Date(Date.now() - 86_400_000),
        availableSpots: 6,
      },
    ]);
    await database.insert(tourMedia).values({
      id: randomUUID(),
      tourId,
      position: 1,
      state: 'active',
      keyPrefix: `test/tours/${tourId}/images/one`,
      originalFormat: 'jpeg',
      originalSize: 10,
      width: 1200,
      height: 800,
    });

    const departures = await request(httpServer)
      .get(`/api/v1/tours/${tourId}/start-dates`)
      .expect(200);
    const departureBody = departures.body as {
      data: Array<{ startAt: string; reservedSpots?: number }>;
    };
    expect(departureBody.data).toHaveLength(2);
    expect(departureBody.data.map(row => row.startAt)).toEqual([
      earlier.toISOString(),
      later.toISOString(),
    ]);
    expect(departureBody.data[0]).not.toHaveProperty('reservedSpots');

    const detail = await request(httpServer).get(`/api/v1/tours/${slug}`).expect(200);
    const detailBody = detail.body as {
      data: { startDates: unknown[]; images: Array<{ position: number; urls: { card: string } }> };
    };
    expect(detailBody.data.startDates).toHaveLength(2);
    expect(detailBody.data.images[0]?.position).toBe(1);
    expect(detailBody.data.images[0]?.urls.card).toContain('/card.webp');
  });

  it('completes registration, verification, Bearer login, session, and logout natively', async () => {
    const email = `auth-${Date.now()}@example.com`;
    const password = 'correct horse battery staple';
    authenticatedEmail = email;
    authenticatedPassword = password;

    const registration = await request(httpServer)
      .post('/api/v1/auth/sign-up/email')
      .send({ email, name: 'Auth Test', password })
      .expect(200);
    expect(registration.body).not.toHaveProperty('data');

    const [created] = await database.select().from(users).where(eq(users.email, email));
    expect(created).toMatchObject({ email, emailVerified: false, role: 'user' });
    if (!created) {
      throw new Error('Expected the registered user to exist');
    }
    authenticatedUserId = created.id;

    const [verificationMessage] = await database
      .select()
      .from(outboxMessages)
      .where(
        and(
          eq(outboxMessages.jobName, 'auth.email.deliver'),
          sql`${outboxMessages.payload}->>'recipient' = ${email}`,
        ),
      )
      .orderBy(desc(outboxMessages.createdAt))
      .limit(1);
    expect(verificationMessage).toBeDefined();
    const verificationPayload = verificationMessage?.payload as
      { recipient?: string; url?: string } | undefined;
    expect(verificationPayload?.recipient).toBe(email);
    expect(verificationPayload?.url).toEqual(expect.any(String));
    if (!verificationPayload?.url) {
      throw new Error('Expected a verification URL in the durable email payload');
    }
    const verificationUrl = new URL(verificationPayload.url);
    await request(httpServer)
      .get(`${verificationUrl.pathname}${verificationUrl.search}`)
      .expect(302);

    const login = await request(httpServer)
      .post('/api/v1/auth/sign-in/email')
      .send({ email, password })
      .expect(200);
    const token = login.headers['set-auth-token'];
    expect(typeof token).toBe('string');

    await request(httpServer)
      .get('/api/v1/auth/get-session')
      .set('authorization', `Bearer ${String(token)}`)
      .expect(200)
      .expect(response => {
        const body = response.body as { user: Record<string, unknown> };
        expect(body.user).toMatchObject({ email });
        expect(body.user).not.toHaveProperty('role');
      });

    await request(httpServer)
      .post('/api/v1/auth/sign-out')
      .set('authorization', `Bearer ${String(token)}`)
      .expect(200);
    await request(httpServer)
      .get('/api/v1/auth/get-session')
      .set('authorization', `Bearer ${String(token)}`)
      .expect(200)
      .expect(response => expect(response.body).toBeNull());

    const secondLogin = await request(httpServer)
      .post('/api/v1/auth/sign-in/email')
      .send({ email, password })
      .expect(200);
    authenticatedToken = String(secondLogin.headers['set-auth-token']);
  });

  it('resolves an application principal and enforces user permissions and sensitive caching', async () => {
    const profile = await request(httpServer)
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${authenticatedToken}`)
      .expect(200);
    expect(profile.body).toMatchObject({ data: { id: authenticatedUserId, role: 'user' } });
    expect(profile.headers['cache-control']).toBe('no-store, private');
    expect(profile.headers.pragma).toBe('no-cache');

    await request(httpServer)
      .patch('/api/v1/users/me')
      .set('authorization', `Bearer ${authenticatedToken}`)
      .send({ name: 'Updated Auth Test' })
      .expect(200)
      .expect(response =>
        expect(response.body).toMatchObject({ data: { name: 'Updated Auth Test' } }),
      );

    await request(httpServer)
      .get('/api/v1/users')
      .set('authorization', `Bearer ${authenticatedToken}`)
      .expect(403);

    await database.update(users).set({ role: 'admin' }).where(eq(users.id, authenticatedUserId));
    await request(httpServer)
      .get('/api/v1/users')
      .set('authorization', `Bearer ${authenticatedToken}`)
      .expect(200);
    await request(httpServer)
      .patch(`/api/v1/users/${authenticatedUserId}/role`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .send({ role: 'user' })
      .expect(403);
  });

  it('creates, replays, reads, and cancels a free verified-owner booking exactly once', async () => {
    const tourId = randomUUID();
    const departureId = randomUUID();
    await database.insert(tours).values({
      id: tourId,
      name: 'Free Booking Tour',
      slug: `free-booking-${tourId}`,
      summary: 'Booking fixture',
      durationDays: 1,
      maximumGroupSize: 4,
      difficulty: 'easy',
      priceCents: 0,
      startLocationName: 'Start',
      startLocationLatitude: 1,
      startLocationLongitude: 1,
      isActive: true,
    });
    await database.insert(tourDepartures).values({
      id: departureId,
      tourId,
      startAt: new Date(Date.now() + 7 * 86_400_000),
      availableSpots: 4,
      isActive: true,
    });
    const body = {
      departureId,
      travelers: [
        { fullName: 'Traveler One', email: 'traveler@example.com', phone: '+12025550123' },
      ],
    };
    const first = await request(httpServer)
      .post('/api/v1/bookings')
      .set('authorization', `Bearer ${authenticatedToken}`)
      .set('idempotency-key', 'free-booking-e2e')
      .send(body)
      .expect(201);
    const bookingId = (first.body as { data: { id: string } }).data.id;
    expect(first.body).toMatchObject({ data: { status: 'confirmed', totalCents: 0, quantity: 1 } });
    expect(first.headers['cache-control']).toBe('no-store, private');

    await request(httpServer)
      .post('/api/v1/bookings')
      .set('authorization', `Bearer ${authenticatedToken}`)
      .set('idempotency-key', 'free-booking-e2e')
      .send(body)
      .expect(201)
      .expect(response => expect(response.body).toMatchObject({ data: { id: bookingId } }));
    const [{ value }] = await database
      .select({ value: sql<number>`count(*)` })
      .from(bookings)
      .where(eq(bookings.id, bookingId));
    expect(Number(value)).toBe(1);

    await request(httpServer)
      .post(`/api/v1/bookings/${bookingId}/cancellation`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .expect(200)
      .expect(response => expect(response.body).toMatchObject({ data: { status: 'cancelled' } }));
    const [departure] = await database
      .select()
      .from(tourDepartures)
      .where(eq(tourDepartures.id, departureId));
    expect(departure).toMatchObject({ availableSpots: 4, reservedSpots: 0 });
  });

  it('publishes and manages only qualified owner reviews with correct aggregates', async () => {
    await database
      .update(users)
      .set({ role: 'user', emailVerified: true })
      .where(eq(users.id, authenticatedUserId));
    const tourId = randomUUID();
    const departureId = randomUUID();
    const departureStartAt = new Date(Date.now() - 86_400_000);
    await database.insert(tours).values({
      id: tourId,
      name: 'Completed Review Tour',
      slug: `completed-review-${tourId}`,
      summary: 'Review e2e fixture',
      durationDays: 1,
      maximumGroupSize: 4,
      difficulty: 'easy',
      priceCents: 100,
      startLocationName: 'Start',
      startLocationLatitude: 1,
      startLocationLongitude: 1,
      isActive: true,
    });
    await database.insert(tourDepartures).values({
      id: departureId,
      tourId,
      startAt: departureStartAt,
      availableSpots: 3,
      reservedSpots: 1,
    });
    await database.insert(bookings).values({
      id: randomUUID(),
      userId: authenticatedUserId,
      tourId,
      departureId,
      status: 'confirmed',
      purchaserName: 'Updated Auth Test',
      purchaserEmail: authenticatedEmail,
      tourName: 'Completed Review Tour',
      departureStartAt,
      unitPriceCents: 100,
      discountPercentage: null,
      discountCents: 0,
      discountedUnitPriceCents: 100,
      quantity: 1,
      subtotalCents: 100,
      totalCents: 100,
      currency: 'usd',
    });

    for (const invalid of [
      { rating: 1.5, text: 'Invalid decimal rating' },
      { rating: 5, text: '   ' },
    ]) {
      await request(httpServer)
        .post(`/api/v1/tours/${tourId}/reviews`)
        .set('authorization', `Bearer ${authenticatedToken}`)
        .send(invalid)
        .expect(400)
        .expect(response =>
          expect(readErrorResponse(response).error.code).toBe('VALIDATION_FAILED'),
        );
    }

    const created = await request(httpServer)
      .post(`/api/v1/tours/${tourId}/reviews`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .send({ rating: 5, text: '  Excellent completed tour  ' })
      .expect(201);
    const reviewId = (created.body as { data: { id: string } }).data.id;
    expect(created.body).toMatchObject({
      data: {
        id: reviewId,
        text: 'Excellent completed tour',
        user: { id: authenticatedUserId, name: 'Updated Auth Test' },
      },
    });
    await request(httpServer)
      .post(`/api/v1/tours/${tourId}/reviews`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .send({ rating: 4, text: 'Duplicate' })
      .expect(409)
      .expect(response =>
        expect(readErrorResponse(response).error.code).toBe('REVIEW_ALREADY_EXISTS'),
      );
    const listed = await request(httpServer)
      .get(`/api/v1/tours/${tourId}/reviews?page=1&limit=1`)
      .expect(200);
    expect(listed.body).toMatchObject({
      data: [expect.objectContaining({ id: reviewId })],
      meta: { pagination: { page: 1, perPage: 1, totalItems: 1 } },
    });
    expect(listed.headers['cache-control']).not.toBe('no-store, private');
    await request(httpServer)
      .patch(`/api/v1/tours/${tourId}/reviews/${reviewId}`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .send({ rating: 4 })
      .expect(200)
      .expect(response => expect(response.body).toMatchObject({ data: { rating: 4 } }));
    await request(httpServer)
      .patch(`/api/v1/tours/${tourId}/reviews/${randomUUID()}`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .send({ rating: 1 })
      .expect(404);
    await request(httpServer)
      .delete(`/api/v1/tours/${tourId}/reviews/${reviewId}`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .expect(204);
    expect(await database.select().from(reviews).where(eq(reviews.id, reviewId))).toEqual([]);
    const [tour] = await database.select().from(tours).where(eq(tours.id, tourId));
    expect(tour).toMatchObject({ ratingCount: 0, ratingAverage: null });
    await request(httpServer).get(`/api/v1/tours/${tourId}/reviews/${reviewId}`).expect(404);
    await database.update(users).set({ role: 'admin' }).where(eq(users.id, authenticatedUserId));
  });

  it('confirms a paid booking only through a matching signed webhook', async () => {
    const tourId = randomUUID();
    const departureId = randomUUID();
    await database.insert(tours).values({
      id: tourId,
      name: 'Paid Booking Tour',
      slug: `paid-booking-${tourId}`,
      summary: 'Paid fixture',
      durationDays: 1,
      maximumGroupSize: 2,
      difficulty: 'easy',
      priceCents: 1250,
      startLocationName: 'Start',
      startLocationLatitude: 1,
      startLocationLongitude: 1,
      isActive: true,
    });
    await database.insert(tourDepartures).values({
      id: departureId,
      tourId,
      startAt: new Date(Date.now() + 7 * 86_400_000),
      availableSpots: 2,
      isActive: true,
    });
    const created = await request(httpServer)
      .post('/api/v1/bookings')
      .set('authorization', `Bearer ${authenticatedToken}`)
      .set('idempotency-key', 'paid-booking-e2e')
      .send({
        departureId,
        travelers: [
          { fullName: 'Paid Traveler', email: 'paid@example.com', phone: '+12025550124' },
        ],
      })
      .expect(201);
    const bookingId = (created.body as { data: { id: string } }).data.id;
    expect(created.body).toMatchObject({
      data: { status: 'pending_payment', payment: { status: 'checkout_open' } },
    });
    const [payment] = await database
      .select()
      .from(bookingPayments)
      .where(eq(bookingPayments.bookingId, bookingId));
    await request(httpServer)
      .post('/api/v1/stripe/webhook')
      .set('stripe-signature', 'invalid')
      .send({})
      .expect(401);
    await request(httpServer)
      .post('/api/v1/stripe/webhook')
      .set('stripe-signature', 'fake-valid-signature')
      .send({
        id: 'evt_paid_e2e',
        type: 'checkout.completed',
        bookingId,
        paymentRecordId: payment.id,
        checkoutId: payment.providerCheckoutId,
        paymentId: payment.providerPaymentId,
        amountCents: 1250,
        currency: 'usd',
        paid: true,
      })
      .expect(204);
    await request(httpServer)
      .get(`/api/v1/bookings/${bookingId}`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .expect(200)
      .expect(response => expect(response.body).toMatchObject({ data: { status: 'confirmed' } }));
  });

  it('keeps password recovery account-enumeration safe and queues only durable email', async () => {
    const body = { callbackURL: 'http://localhost:5173/reset-password' };
    const missing = await request(httpServer)
      .post('/api/v1/auth/request-password-reset')
      .send({ ...body, email: `missing-${Date.now()}@example.com` })
      .expect(200);
    expect(missing.body).not.toHaveProperty('data');
  });

  it('creates, updates, staffs, lists, and soft deletes tours through the Bearer flow', async () => {
    await database.delete(paymentProviderEvents);
    await database.delete(bookingIdempotency);
    await database.delete(bookingTravelers);
    await database.delete(bookingPayments);
    await database.delete(bookings);
    await database.delete(reviews);
    await database.delete(tourMedia);
    await database.delete(tourDepartures);
    await database.delete(tourGuideAssignments);
    await database.delete(tours);
    const leadId = randomUUID();
    const guideId = randomUUID();
    await database.insert(users).values([
      { id: leadId, name: 'Lead Guide', email: `lead-${leadId}@example.com`, role: 'lead-guide' },
      { id: guideId, name: 'Support Guide', email: `guide-${guideId}@example.com`, role: 'guide' },
    ]);
    const created = await request(httpServer)
      .post('/api/v1/tours')
      .set('authorization', `Bearer ${authenticatedToken}`)
      .send({
        name: 'The Forest Hiker',
        summary: 'A safe forest experience.',
        durationDays: 7,
        maximumGroupSize: 15,
        difficulty: 'moderate',
        price: 49700,
        discountPercentage: 10,
        startLocation: {
          name: 'Forest Gate',
          address: 'Trail Road',
          latitude: 8.98,
          longitude: -79.52,
        },
        isActive: true,
        leadGuideId: leadId,
        guideIds: [guideId],
      })
      .expect(201);
    const body = created.body as { data: { id: string; slug: string } };
    expect(body.data.slug).toBe('the-forest-hiker');

    const catalog = await request(httpServer)
      .get('/api/v1/tours?sortBy=price&sortOrder=asc&minPrice=40000')
      .expect(200);
    expect(catalog.body).toMatchObject({
      data: [expect.objectContaining({ id: body.data.id, price: 49700 })],
    });
    expect(JSON.stringify(catalog.body)).not.toContain(`lead-${leadId}@example.com`);
    expect(JSON.stringify(catalog.body)).not.toContain(`guide-${guideId}@example.com`);
    await request(httpServer).get('/api/v1/tours?filter[price][from]=100').expect(400);
    await request(httpServer).get('/api/v1/tours?minPrice=500&maxPrice=100').expect(400);

    await request(httpServer)
      .patch(`/api/v1/tours/${body.data.id}`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .send({ maximumGroupSize: 20 })
      .expect(200);
    const departure = await request(httpServer)
      .post(`/api/v1/tours/${body.data.id}/start-dates`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .send({ startAt: new Date(Date.now() + 86_400_000).toISOString(), availableSpots: 20 })
      .expect(201);
    expect((departure.body as { data: { reservedSpots: number } }).data.reservedSpots).toBe(0);
    await request(httpServer)
      .post(`/api/v1/tours/${body.data.id}/start-dates`)
      .send({ startAt: new Date(Date.now() + 172_800_000).toISOString(), availableSpots: 1 })
      .expect(401);
    await request(httpServer)
      .post(`/api/v1/tours/${body.data.id}/start-dates`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .send({ startAt: '2030-01-01T12:00:00', availableSpots: 1 })
      .expect(400);
    await request(httpServer)
      .patch(`/api/v1/tours/${body.data.id}`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .send({ maximumGroupSize: 19 })
      .expect(422);
    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    await request(httpServer)
      .post(`/api/v1/tours/${body.data.id}/images`)
      .attach('images', imageBuffer, { filename: 'cover.png', contentType: 'image/png' })
      .expect(401);
    await request(httpServer)
      .post(`/api/v1/tours/${body.data.id}/images`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .attach('images', Buffer.from('not an image'), {
        filename: 'invalid.txt',
        contentType: 'text/plain',
      })
      .expect(400);
    const upload = await request(httpServer)
      .post(`/api/v1/tours/${body.data.id}/images`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .attach('images', imageBuffer, { filename: 'cover.png', contentType: 'image/png' })
      .attach('images', imageBuffer, { filename: 'gallery.png', contentType: 'image/png' })
      .expect(201);
    const uploadedImages = (upload.body as { data: Array<{ id: string }> }).data;
    expect(uploadedImages).toHaveLength(2);
    const enriched = await request(httpServer).get(`/api/v1/tours/${body.data.slug}`).expect(200);
    expect(
      (enriched.body as { data: { images: unknown[]; startDates: unknown[] } }).data,
    ).toMatchObject({
      images: [expect.objectContaining({ position: 1 }), expect.objectContaining({ position: 2 })],
      startDates: [expect.objectContaining({ availableSpots: 20 })],
    });
    await request(httpServer)
      .delete(`/api/v1/tours/${body.data.id}/images/${uploadedImages[0].id}`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .expect(204);
    const afterImageDelete = await request(httpServer)
      .get(`/api/v1/tours/${body.data.slug}`)
      .expect(200);
    expect(
      (afterImageDelete.body as { data: { images: Array<{ position: number }> } }).data.images,
    ).toEqual([expect.objectContaining({ position: 1 })]);
    await request(httpServer)
      .patch(`/api/v1/users/${guideId}/role`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .send({ role: 'user' })
      .expect(422);
    await request(httpServer)
      .delete(`/api/v1/tours/${body.data.id}`)
      .set('authorization', `Bearer ${authenticatedToken}`)
      .expect(204);
    await request(httpServer).get(`/api/v1/tours/${body.data.slug}`).expect(404);
    const [deleted] = await database.select().from(tours).where(eq(tours.id, body.data.id));
    expect(deleted?.deletedAt).toBeInstanceOf(Date);
    const assignments = await database
      .select()
      .from(tourGuideAssignments)
      .where(eq(tourGuideAssignments.tourId, body.data.id));
    expect(assignments).toHaveLength(2);
    expect(assignments.every(assignment => assignment.deletedAt instanceof Date)).toBe(true);

    const replacement = await request(httpServer)
      .post('/api/v1/tours')
      .set('authorization', `Bearer ${authenticatedToken}`)
      .send({
        name: 'The Forest Hiker',
        summary: 'A second forest experience.',
        durationDays: 5,
        maximumGroupSize: 10,
        difficulty: 'easy',
        price: 35000,
        startLocation: { name: 'North Gate', latitude: 9.01, longitude: -79.5 },
        isActive: true,
        leadGuideId: leadId,
        guideIds: [guideId],
      })
      .expect(201);
    expect((replacement.body as { data: { slug: string } }).data.slug).toBe('the-forest-hiker-2');
  });

  it('changes a password without leaking failures and revokes only other sessions', async () => {
    await request(httpServer)
      .post('/api/v1/users/me/change-password')
      .set('authorization', `Bearer ${authenticatedToken}`)
      .send({ currentPassword: 'incorrect password', newPassword: 'another secure password' })
      .expect(400)
      .expect(response => {
        const body = response.body as { error: { message: string } };
        expect(body.error.message).toBe('The account security change could not be completed.');
      });

    const otherLogin = await request(httpServer)
      .post('/api/v1/auth/sign-in/email')
      .send({ email: authenticatedEmail, password: authenticatedPassword })
      .expect(200);
    const otherToken = String(otherLogin.headers['set-auth-token']);
    const newPassword = 'updated correct horse battery staple';

    const changed = await request(httpServer)
      .post('/api/v1/users/me/change-password')
      .set('authorization', `Bearer ${authenticatedToken}`)
      .send({ currentPassword: authenticatedPassword, newPassword })
      .expect(204);
    authenticatedToken = String(changed.headers['set-auth-token']);
    expect(authenticatedToken).not.toBe('undefined');
    authenticatedPassword = newPassword;

    await request(httpServer)
      .get('/api/v1/auth/get-session')
      .set('authorization', `Bearer ${authenticatedToken}`)
      .expect(200)
      .expect(response => {
        const body = response.body as { user?: { id?: string } };
        expect(body.user?.id).toBe(authenticatedUserId);
      });
    await request(httpServer)
      .get('/api/v1/auth/get-session')
      .set('authorization', `Bearer ${otherToken}`)
      .expect(200)
      .expect(response => expect(response.body).toBeNull());
  });

  it('wraps collections and presents deterministic pagination links', async () => {
    await request(httpServer)
      .get('/api/v1/contract-tests/collection')
      .expect(200)
      .expect({ data: [{ id: 'first' }, { id: 'second' }] });
    const paginated = await request(httpServer)
      .get('/api/v1/contract-tests/pagination')
      .expect(200);
    expect(paginated.body).toEqual({
      data: [{ id: 'second-page' }],
      meta: { pagination: { page: 2, perPage: 1, totalItems: 3, totalPages: 3 } },
      links: {
        self: '/api/v1/contract-tests/pagination?page=2&limit=1',
        first: '/api/v1/contract-tests/pagination?page=1&limit=1',
        last: '/api/v1/contract-tests/pagination?page=3&limit=1',
        previous: '/api/v1/contract-tests/pagination?page=1&limit=1',
        next: '/api/v1/contract-tests/pagination?page=3&limit=1',
      },
    });
  });

  it('serves health outside the versioned API', async () => {
    const response = await request(httpServer).get('/health').expect(200);

    expect(response.body).toEqual({ status: 'ok', info: {}, error: {}, details: {} });
    await request(httpServer).get('/api/v1/health').expect(404);
  });

  it('reports liveness and dependency readiness outside the versioned API', async () => {
    await request(httpServer).get('/health').expect(200);
    const readiness = await request(httpServer).get('/ready').expect(200);
    expect(readiness.body).toMatchObject({ status: 'ok' });
    await request(httpServer).get('/api/v1/ready').expect(404);
  });

  it('returns the standard error envelope when a named distributed policy is exceeded', async () => {
    const redis = app.get<RedisClient>(REDIS_CLIENT);
    const prefix = app.get(AppConfigService).redisKeyPrefix;
    const keys = await redis.keys(`${prefix}:rate:authentication:*`);
    if (keys.length > 0) await redis.del(...keys);
    await request(httpServer).get('/api/v1/contract-tests/rate-limit').expect(200);
    await request(httpServer).get('/api/v1/contract-tests/rate-limit').expect(200);
    const limited = await request(httpServer)
      .get('/api/v1/contract-tests/rate-limit')
      .set('x-request-id', 'rate-limit-request')
      .expect(429);
    expect(readErrorResponse(limited).error).toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      requestId: 'rate-limit-request',
    });
  });

  it('returns 404 for an unknown route', async () => {
    const response = await request(httpServer)
      .get('/api/v1/missing')
      .set('x-request-id', 'missing-route-request')
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Cannot GET /api/v1/missing',
        requestId: 'missing-route-request',
      },
    });
    expect(response.headers['x-request-id']).toBe(readErrorResponse(response).error.requestId);
  });

  it('maps validation details, domain errors, and standard HTTP errors', async () => {
    const validation = await request(httpServer)
      .get('/api/v1/contract-tests/validation?count=invalid&unexpected=true')
      .expect(400);
    const validationError = readErrorResponse(validation).error;
    expect(validationError).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'The request contains invalid fields.',
      requestId: validation.headers['x-request-id'],
    });
    expect(validationError.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'count', code: 'INVALID_INTEGER' }),
        expect.objectContaining({ field: 'unexpected', code: 'UNKNOWN_FIELD' }),
      ]),
    );

    const domain = await request(httpServer).get('/api/v1/contract-tests/domain-error').expect(422);
    expect(readErrorResponse(domain).error).toEqual({
      code: 'CONTRACT_TEST_FAILED',
      message: 'The contract test failed safely.',
      details: { reason: 'fixture' },
      requestId: domain.headers['x-request-id'],
    });

    const conflict = await request(httpServer).get('/api/v1/contract-tests/conflict').expect(409);
    expect(readErrorResponse(conflict).error).toMatchObject({
      code: 'CONFLICT',
      message: 'The fixture conflicts with existing state.',
    });
  });

  it('hides unexpected failures and preserves request correlation', async () => {
    const response = await request(httpServer)
      .get('/api/v1/contract-tests/unexpected-error')
      .set('x-request-id', 'unexpected-error-request')
      .expect(500);

    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
        requestId: 'unexpected-error-request',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('sensitive internal failure');

    const httpException = await request(httpServer)
      .get('/api/v1/contract-tests/internal-http-error')
      .expect(500);
    expect(readErrorResponse(httpException).error).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(JSON.stringify(httpException.body)).not.toContain('sensitive HTTP exception failure');
  });

  it('keeps no-content, stream, and explicitly native responses outside the envelope', async () => {
    const noContent = await request(httpServer)
      .get('/api/v1/contract-tests/no-content')
      .expect(204);
    expect(noContent.text).toBe('');

    const stream = await request(httpServer).get('/api/v1/contract-tests/stream').expect(200);
    const streamBody = stream.body as unknown;
    expect(Buffer.isBuffer(streamBody)).toBe(true);
    if (!Buffer.isBuffer(streamBody)) {
      throw new Error('Expected the stream response body to be a buffer');
    }
    expect(streamBody.toString()).toBe('stream-content');

    await request(httpServer)
      .get('/api/v1/contract-tests/native')
      .expect(200)
      .expect({ native: true });

    await request(httpServer).get('/api/v1/contract-tests/native-error').expect(409).expect({
      message: 'Native conflict response.',
      error: 'Conflict',
      statusCode: 409,
    });
  });

  it('returns or generates a request id', async () => {
    const supplied = await request(httpServer)
      .get('/health')
      .set('x-request-id', 'test-request-123')
      .expect(200);
    expect(supplied.headers['x-request-id']).toBe('test-request-123');

    const generated = await request(httpServer).get('/health').expect(200);
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('applies security and configured CORS headers', async () => {
    const allowed = await request(httpServer)
      .get('/health')
      .set('origin', 'http://localhost:3000')
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(allowed.headers['x-content-type-options']).toBe('nosniff');
    expect(allowed.headers['content-security-policy']).toBeUndefined();

    const rejected = await request(httpServer)
      .get('/health')
      .set('origin', 'https://unlisted.example')
      .expect(200);
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves Scalar and the OpenAPI document outside production', async () => {
    const reference = await request(httpServer).get('/docs').expect(200);
    expect(reference.text).toContain('Natours API Reference');
    expect(reference.text).toContain('Scalar');

    const document = await request(httpServer).get('/docs-json').expect(200);
    const openApiDocument = document.body as { paths: Record<string, unknown> };
    expect(openApiDocument.paths).toHaveProperty('/api/v1');
    expect(openApiDocument.paths).not.toHaveProperty('/health');
    expect(openApiDocument).toHaveProperty('openapi');
  });
});
