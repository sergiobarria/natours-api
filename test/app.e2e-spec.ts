import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { AppConfigService } from '../src/config/app-config.service';

describe('application foundation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(app.get(Logger));
    await configureApplication(app, app.get(AppConfigService));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the versioned API root', async () => {
    await request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect({ name: 'natours-api', version: '1' });
  });

  it('serves health outside the versioned API', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toEqual({ status: 'ok', info: {}, error: {}, details: {} });
    await request(app.getHttpServer()).get('/api/v1/health').expect(404);
  });

  it('returns 404 for an unknown route', async () => {
    await request(app.getHttpServer()).get('/api/v1/missing').expect(404);
  });

  it('returns or generates a request id', async () => {
    const supplied = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'test-request-123')
      .expect(200);
    expect(supplied.headers['x-request-id']).toBe('test-request-123');

    const generated = await request(app.getHttpServer()).get('/health').expect(200);
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('applies security and configured CORS headers', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/health')
      .set('origin', 'http://localhost:3000')
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(allowed.headers['x-content-type-options']).toBe('nosniff');
    expect(allowed.headers['content-security-policy']).toBeUndefined();

    const rejected = await request(app.getHttpServer())
      .get('/health')
      .set('origin', 'https://unlisted.example')
      .expect(200);
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves Scalar and the OpenAPI document outside production', async () => {
    const reference = await request(app.getHttpServer()).get('/docs').expect(200);
    expect(reference.text).toContain('Natours API Reference');
    expect(reference.text).toContain('Scalar');

    const document = await request(app.getHttpServer()).get('/docs-json').expect(200);
    const openApiDocument = document.body as { paths: Record<string, unknown> };
    expect(openApiDocument.paths).toHaveProperty('/api/v1');
  });
});
