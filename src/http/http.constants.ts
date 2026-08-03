export const HTTP_HEADERS = {
  requestId: 'x-request-id',
} as const;

export const REQUEST_ID_CONTRACT = {
  maxLength: 128,
  minLength: 1,
  pattern: '^[A-Za-z0-9._:-]{1,128}$',
} as const;

export const HTTP_ROUTES = {
  apiPrefix: 'api',
  catchAll: '{*path}',
  docs: 'docs',
  docsJson: 'docs-json',
  health: 'health',
} as const;

export const API_CONTRACT = {
  description: 'HTTP API for the Natours application',
  name: 'Natours API',
  referenceTitle: 'Natours API Reference',
  serviceName: 'natours-api',
  version: '1',
} as const;
