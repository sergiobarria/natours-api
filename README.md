# Natours API

NestJS 11 and TypeScript API for the Natours application.

## Requirements

- Node.js 24
- pnpm 11.18.0 (pinned through `packageManager`)

Install Corepack if your Node distribution does not include it, then install the pinned package manager and dependencies:

```shell
npm install --global corepack@latest
corepack enable
corepack install
pnpm install --frozen-lockfile
cp .env.example .env
```

## Development

```shell
pnpm start:dev
```

The initial HTTP surface is:

- `GET /api/v1` — API discovery response
- `GET /health` — unversioned process health
- `/docs` and `/docs-json` — Scalar API reference and OpenAPI JSON outside production

Configuration is validated at startup. Production requires an explicit comma-separated `CORS_ORIGINS` allowlist. Requests accept an optional `x-request-id`; the API returns that ID (or a generated UUID) and includes it in structured logs.

## Quality checks

```shell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

See `docs/01_SPEC.md` for the product contract and `docs/05_DEVELOPMENT.md` for the contributor workflow. PostgreSQL, Redis, background workers, scheduling, and Sentry are planned but are not part of the current foundation.
