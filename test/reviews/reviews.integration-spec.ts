import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { purgeDatabase } from '../../scripts/database/purge-database.js';
import { DatabaseUnitOfWork } from '../../src/database/database-unit-of-work.js';
import { bookings } from '../../src/database/schema/bookings.js';
import { users } from '../../src/database/schema/identity.js';
import { reviews } from '../../src/database/schema/reviews.js';
import { tourDepartures, tours } from '../../src/database/schema/tours.js';
import { DomainError } from '../../src/http/errors/domain.error.js';
import { ReviewsService } from '../../src/reviews/reviews.service.js';
import { createTestDatabase, TestDatabase } from '../database/test-database.js';

describe('qualified reviews', () => {
  let testDatabase: TestDatabase;
  let service: ReviewsService;

  beforeAll(async () => {
    testDatabase = await createTestDatabase();
    await testDatabase.migrateProduction();
    service = new ReviewsService(
      testDatabase.database,
      new DatabaseUnitOfWork(testDatabase.database),
    );
  });
  beforeEach(async () => purgeDatabase(testDatabase.pool, testDatabase.url));
  afterAll(async () => testDatabase.release());

  async function fixture(
    options: { status?: typeof bookings.$inferInsert.status; past?: boolean } = {},
  ) {
    const userId = randomUUID();
    const tourId = randomUUID();
    const departureId = randomUUID();
    const departureStartAt = new Date(
      Date.now() + ((options.past ?? true) ? -86_400_000 : 86_400_000),
    );
    await testDatabase.database.insert(users).values({
      id: userId,
      name: 'Review Author',
      email: `${userId}@example.com`,
      emailVerified: true,
    });
    await testDatabase.database.insert(tours).values({
      id: tourId,
      name: 'Review Tour',
      slug: `review-${tourId}`,
      summary: 'A tour to review',
      durationDays: 3,
      maximumGroupSize: 10,
      difficulty: 'easy',
      priceCents: 100,
      startLocationName: 'Start',
      startLocationLatitude: 1,
      startLocationLongitude: 1,
      isActive: true,
    });
    await testDatabase.database.insert(tourDepartures).values({
      id: departureId,
      tourId,
      startAt: departureStartAt,
      availableSpots: 9,
      reservedSpots: 1,
    });
    await testDatabase.database.insert(bookings).values({
      id: randomUUID(),
      userId,
      tourId,
      departureId,
      status: options.status ?? 'confirmed',
      purchaserName: 'Review Author',
      purchaserEmail: `${userId}@example.com`,
      tourName: 'Review Tour',
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
    return { tourId, userId };
  }

  async function addQualifiedUser(tourId: string, offsetDays: number) {
    const userId = randomUUID();
    const departureId = randomUUID();
    const departureStartAt = new Date(Date.now() - offsetDays * 86_400_000);
    await testDatabase.database.insert(users).values({
      id: userId,
      name: `Review Author ${offsetDays}`,
      email: `${userId}@example.com`,
      emailVerified: true,
    });
    await testDatabase.database.insert(tourDepartures).values({
      id: departureId,
      tourId,
      startAt: departureStartAt,
      availableSpots: 9,
      reservedSpots: 1,
    });
    await testDatabase.database.insert(bookings).values({
      id: randomUUID(),
      userId,
      tourId,
      departureId,
      status: 'confirmed',
      purchaserName: `Review Author ${offsetDays}`,
      purchaserEmail: `${userId}@example.com`,
      tourName: 'Review Tour',
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
    return userId;
  }

  it.each([
    ['pending_payment', true],
    ['cancelled', true],
    ['expired', true],
    ['cancellation_pending', true],
    ['cancellation_failed', true],
    ['confirmed', false],
  ] as const)('rejects %s booking with past=%s', async (status, past) => {
    const source = await fixture({ status, past });
    await expect(
      service.create(source.userId, source.tourId, { rating: 5, text: 'Not qualified' }),
    ).rejects.toMatchObject<Partial<DomainError>>({ code: 'REVIEW_NOT_QUALIFIED', status: 422 });
  });

  it('creates, updates, lists, and hard-deletes while recomputing aggregates', async () => {
    const source = await fixture();
    const first = await service.create(source.userId, source.tourId, {
      rating: 3,
      text: 'Good tour',
    });
    expect(first.user).toEqual({ id: source.userId, name: 'Review Author' });
    await service.update(source.userId, source.tourId, first.id, { rating: 4 });
    await expect(
      service.create(source.userId, source.tourId, { rating: 5, text: 'Duplicate' }),
    ).rejects.toMatchObject<Partial<DomainError>>({ code: 'REVIEW_ALREADY_EXISTS', status: 409 });
    const [updated] = await testDatabase.database
      .select()
      .from(tours)
      .where(eq(tours.id, source.tourId));
    expect(updated).toMatchObject({ ratingAverage: '4.00', ratingCount: 1 });
    expect((await service.list(source.tourId, { page: 1, limit: 20 })).items).toHaveLength(1);
    await service.delete(source.userId, source.tourId, first.id);
    expect(await testDatabase.database.select().from(reviews)).toEqual([]);
    const [deleted] = await testDatabase.database
      .select()
      .from(tours)
      .where(eq(tours.id, source.tourId));
    expect(deleted).toMatchObject({ ratingAverage: null, ratingCount: 0 });
  });

  it('conceals foreign ownership and permits inactive but not deleted tours', async () => {
    const source = await fixture();
    const review = await service.create(source.userId, source.tourId, { rating: 5, text: 'Great' });
    await expect(
      service.update(randomUUID(), source.tourId, review.id, { rating: 1 }),
    ).rejects.toMatchObject({ status: 404 });
    await testDatabase.database
      .update(tours)
      .set({ isActive: false })
      .where(eq(tours.id, source.tourId));
    await expect(
      service.update(source.userId, source.tourId, review.id, { rating: 4 }),
    ).resolves.toMatchObject({ rating: 4 });
    await testDatabase.database
      .update(tours)
      .set({ deletedAt: new Date() })
      .where(eq(tours.id, source.tourId));
    await expect(service.delete(source.userId, source.tourId, review.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('serializes concurrent duplicate creation and preserves the aggregate', async () => {
    const source = await fixture();
    const results = await Promise.allSettled([
      service.create(source.userId, source.tourId, { rating: 2, text: 'First' }),
      service.create(source.userId, source.tourId, { rating: 5, text: 'Second' }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    const stored = await testDatabase.database.select().from(reviews);
    const [tour] = await testDatabase.database
      .select()
      .from(tours)
      .where(eq(tours.id, source.tourId));
    expect(tour).toMatchObject({ ratingCount: 1, ratingAverage: `${stored[0]?.rating}.00` });
  });

  it('serializes mixed mutations and rounds the resulting average to two decimals', async () => {
    const source = await fixture();
    const secondUser = await addQualifiedUser(source.tourId, 2);
    const thirdUser = await addQualifiedUser(source.tourId, 3);
    const first = await service.create(source.userId, source.tourId, { rating: 4, text: 'First' });
    const second = await service.create(secondUser, source.tourId, { rating: 4, text: 'Second' });
    await service.create(thirdUser, source.tourId, { rating: 5, text: 'Third' });
    let [tour] = await testDatabase.database
      .select()
      .from(tours)
      .where(eq(tours.id, source.tourId));
    expect(tour).toMatchObject({ ratingCount: 3, ratingAverage: '4.33' });

    const fourthUser = await addQualifiedUser(source.tourId, 4);
    await Promise.all([
      service.update(source.userId, source.tourId, first.id, { rating: 1 }),
      service.delete(secondUser, source.tourId, second.id),
      service.create(fourthUser, source.tourId, { rating: 2, text: 'Fourth' }),
    ]);
    const stored = await testDatabase.database
      .select({ rating: reviews.rating })
      .from(reviews)
      .where(eq(reviews.tourId, source.tourId));
    [tour] = await testDatabase.database.select().from(tours).where(eq(tours.id, source.tourId));
    const expectedAverage = (
      stored.reduce((sum, review) => sum + review.rating, 0) / stored.length
    ).toFixed(2);
    expect(tour).toMatchObject({ ratingCount: stored.length, ratingAverage: expectedAverage });
  });
});
