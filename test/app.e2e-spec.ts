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
import { users } from '../src/database/schema/identity.js';
import { desc, eq } from 'drizzle-orm';
import {
  presentCollection,
  presentPaginated,
  presentResource,
} from '../src/http/response/response.presenter.js';

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
    return presentCollection([{ id: 'first' }, { id: 'second' }]);
  }

  @Get('presented-resource')
  presentedResource() {
    return presentResource({ id: 'presented' });
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
      .where(eq(outboxMessages.jobName, 'auth.email.deliver'))
      .orderBy(desc(outboxMessages.createdAt))
      .limit(1);
    const verificationPayload = verificationMessage?.payload as { url?: string };
    expect(verificationPayload.url).toBeDefined();
    const verificationUrl = new URL(verificationPayload.url!);
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

  it('keeps password recovery account-enumeration safe and queues only durable email', async () => {
    const body = { callbackURL: 'http://localhost:5173/reset-password' };
    const missing = await request(httpServer)
      .post('/api/v1/auth/request-password-reset')
      .send({ ...body, email: `missing-${Date.now()}@example.com` })
      .expect(200);
    expect(missing.body).not.toHaveProperty('data');
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
    await request(httpServer)
      .get('/api/v1/contract-tests/presented-resource')
      .expect(200)
      .expect({ data: { id: 'presented' } });

    const paginated = await request(httpServer)
      .get('/api/v1/contract-tests/pagination')
      .expect(200);
    expect(paginated.body).toEqual({
      data: [{ id: 'second-page' }],
      meta: { pagination: { page: 2, perPage: 1, totalItems: 3, totalPages: 3 } },
      links: {
        self: '/api/v1/contract-tests/pagination?page=2&per_page=1',
        first: '/api/v1/contract-tests/pagination?page=1&per_page=1',
        last: '/api/v1/contract-tests/pagination?page=3&per_page=1',
        previous: '/api/v1/contract-tests/pagination?page=1&per_page=1',
        next: '/api/v1/contract-tests/pagination?page=3&per_page=1',
      },
    });
  });

  it('serves health outside the versioned API', async () => {
    const response = await request(httpServer).get('/health').expect(200);

    expect(response.body).toEqual({ status: 'ok', info: {}, error: {}, details: {} });
    await request(httpServer).get('/api/v1/health').expect(404);
  });

  it('keeps liveness healthy while readiness reports missing process heartbeats', async () => {
    await request(httpServer).get('/health').expect(200);
    const readiness = await request(httpServer).get('/ready').expect(503);
    const readinessBody = readiness.body as {
      status: string;
      error: Record<string, unknown>;
    };
    expect(readinessBody.status).toBe('error');
    expect(Object.keys(readinessBody.error)).toEqual(
      expect.arrayContaining(['scheduler', 'worker']),
    );
    await request(httpServer).get('/api/v1/ready').expect(404);
  });

  it('reports readiness when dependencies and both process roles are healthy', async () => {
    const redis = app.get<RedisClient>(REDIS_CLIENT);
    const prefix = app.get(AppConfigService).redisKeyPrefix;
    const keys = [`${prefix}:heartbeat:worker:e2e`, `${prefix}:heartbeat:scheduler:e2e`];
    await Promise.all(keys.map(key => redis.set(key, 'fresh', 'EX', 5)));
    try {
      const readiness = await request(httpServer).get('/ready').expect(200);
      const body = readiness.body as { status: string };
      expect(body.status).toBe('ok');
    } finally {
      await redis.del(...keys);
    }
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
