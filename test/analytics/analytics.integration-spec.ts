import { randomUUID } from 'node:crypto';
import { purgeDatabase } from '../../scripts/database/purge-database.js';
import { AnalyticsService } from '../../src/analytics/analytics.service.js';
import { bookings } from '../../src/database/schema/bookings.js';
import { users } from '../../src/database/schema/identity.js';
import { tourDepartures, tours } from '../../src/database/schema/tours.js';
import { createTestDatabase, type TestDatabase } from '../database/test-database.js';

describe('tour analytics', () => {
  let testDatabase: TestDatabase;
  let service: AnalyticsService;

  beforeAll(async () => {
    testDatabase = await createTestDatabase();
    await testDatabase.migrateProduction();
    service = new AnalyticsService(testDatabase.pool);
  });
  beforeEach(async () => purgeDatabase(testDatabase.pool, testDatabase.url));
  afterAll(async () => testDatabase.release());

  async function addTour(options: { active?: boolean; deleted?: boolean; name: string }) {
    const id = randomUUID();
    await testDatabase.database.insert(tours).values({
      id,
      name: options.name,
      slug: `${options.name.toLowerCase().replaceAll(' ', '-')}-${id}`,
      summary: 'Analytics fixture',
      durationDays: 5,
      maximumGroupSize: 20,
      difficulty: 'moderate',
      priceCents: 10_000,
      ratingAverage: '4.50',
      ratingCount: 2,
      startLocationName: 'Start',
      startLocationLatitude: 1,
      startLocationLongitude: 1,
      isActive: options.active ?? true,
      deletedAt: options.deleted ? new Date('2026-06-01T00:00:00Z') : null,
    });
    return id;
  }

  async function addDeparture(tourId: string, startAt: string, options = { active: true }) {
    const id = randomUUID();
    await testDatabase.database.insert(tourDepartures).values({
      id,
      tourId,
      startAt: new Date(startAt),
      availableSpots: 14,
      reservedSpots: 6,
      isActive: options.active,
    });
    return id;
  }

  async function addBooking(
    tourId: string,
    departureId: string,
    departureStartAt: string,
    status: typeof bookings.$inferInsert.status,
    quantity: number,
    totalCents: number,
  ) {
    const userId = randomUUID();
    await testDatabase.database.insert(users).values({
      id: userId,
      name: 'Analytics Customer',
      email: `${userId}@example.com`,
      emailVerified: true,
    });
    await testDatabase.database.insert(bookings).values({
      id: randomUUID(),
      userId,
      tourId,
      departureId,
      status,
      purchaserName: 'Analytics Customer',
      purchaserEmail: `${userId}@example.com`,
      tourName: 'Analytics Tour',
      departureStartAt: new Date(departureStartAt),
      unitPriceCents: totalCents / quantity,
      discountCents: 0,
      discountedUnitPriceCents: totalCents / quantity,
      quantity,
      subtotalCents: totalCents,
      totalCents,
    });
  }

  it('ranks confirmed historical demand and retains deleted tours', async () => {
    const deletedTour = await addTour({ name: 'Deleted winner', deleted: true });
    const activeTour = await addTour({ name: 'Active runner up' });
    const deletedDeparture = await addDeparture(deletedTour, '2026-01-01T00:00:00.000Z');
    const activeDeparture = await addDeparture(activeTour, '2026-12-31T23:59:59.999Z');
    await addBooking(
      deletedTour,
      deletedDeparture,
      '2026-01-01T00:00:00.000Z',
      'confirmed',
      3,
      30_000,
    );
    await addBooking(
      activeTour,
      activeDeparture,
      '2026-12-31T23:59:59.999Z',
      'confirmed',
      2,
      20_000,
    );
    await addBooking(
      activeTour,
      activeDeparture,
      '2026-12-31T23:59:59.999Z',
      'cancelled',
      9,
      90_000,
    );

    const result = await service.rankings({
      from: '2026-01-01',
      to: '2027-01-01',
      limit: 20,
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      rank: 1,
      tour: { id: deletedTour, isDeleted: true },
      travelers: 3,
      revenueCents: 30_000,
    });
    expect(result[1]).toMatchObject({ rank: 2, tour: { id: activeTour }, travelers: 2 });
  });

  it('uses half-open UTC boundaries and returns safe empty statistics', async () => {
    await expect(
      service.statistics({ from: '2027-01-01', to: '2026-01-01' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.statistics({ from: '2026-01-01', to: '2027-01-03' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(service.statistics({ from: '2026-01-01', to: '2027-01-01' })).resolves.toEqual({
      from: '2026-01-01',
      to: '2027-01-01',
      tours: 0,
      departures: 0,
      capacity: 0,
      confirmedBookings: 0,
      travelers: 0,
      revenueCents: 0,
      averageBookingValueCents: null,
    });
  });

  it('returns a sparse active-only monthly plan in calendar order', async () => {
    const activeTour = await addTour({ name: 'Plan tour' });
    const inactiveTour = await addTour({ name: 'Hidden plan tour', active: false });
    const march = await addDeparture(activeTour, '2027-03-10T12:00:00.000Z');
    const january = await addDeparture(activeTour, '2027-01-10T12:00:00.000Z');
    await addDeparture(inactiveTour, '2027-02-10T12:00:00.000Z');
    await addBooking(activeTour, march, '2027-03-10T12:00:00.000Z', 'confirmed', 2, 20_000);
    await addBooking(activeTour, january, '2027-01-10T12:00:00.000Z', 'cancelled', 4, 40_000);

    await expect(service.monthlyPlan({ year: 2027 })).resolves.toEqual({
      year: 2027,
      months: [
        {
          month: 1,
          departureCount: 1,
          capacity: 20,
          reservedSpots: 6,
          confirmedBookings: 0,
          travelers: 0,
          revenueCents: 0,
        },
        {
          month: 3,
          departureCount: 1,
          capacity: 20,
          reservedSpots: 6,
          confirmedBookings: 1,
          travelers: 2,
          revenueCents: 20_000,
        },
      ],
    });
  });
});
