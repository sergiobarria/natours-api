import type { OpenAPIObject } from '@nestjs/swagger';
import { normalizeOpenApiDocument } from './openapi-artifact.js';

describe('OpenAPI normalization', () => {
  it('sorts object keys recursively and applies repository formatting', async () => {
    const document = {
      openapi: '3.0.0',
      info: { version: '1', title: 'API' },
      paths: { '/z': {}, '/a': { get: { responses: {} } } },
    } as OpenAPIObject;

    await expect(normalizeOpenApiDocument(document)).resolves.toBe(
      '{\n' +
        '  "info": { "title": "API", "version": "1" },\n' +
        '  "openapi": "3.0.0",\n' +
        '  "paths": { "/a": { "get": { "responses": {} } }, "/z": {} }\n' +
        '}\n',
    );
  });
});
