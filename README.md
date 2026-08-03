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
pnpm db:migrate
pnpm start:dev
```

The API uses PostgreSQL through Drizzle. With DBngin, create dedicated `natours_dev` and
`natours_test` databases on the default passwordless local PostgreSQL instance. The example
environment file is already configured for that setup.

An optional PostgreSQL 18 container is available on port `5433` so it can run alongside DBngin:

```shell
docker compose up -d postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/natours_dev pnpm db:migrate
```

The database workflow is:

```shell
pnpm db:generate -- --name=describe_change # generate a committed SQL migration
pnpm db:check                              # validate migration history
pnpm db:migrate                            # apply pending migrations
pnpm db:seed                               # canonical data, then local demo data
pnpm db:purge                              # clear app rows, preserve migration history
pnpm db:reset                              # purge, migrate, and seed deterministically
pnpm db:studio                             # inspect the configured database
```

`db:purge` and `db:reset` refuse production. Outside production, they only accept database names
listed in `DATABASE_RESET_ALLOWED_DATABASES` and worker databases derived from those names. Set
`ALLOW_DATABASE_RESET=true` only when intentionally resetting another non-production database.
Demo seeds are never production-safe.

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
pnpm test:integration
pnpm test:e2e
pnpm build
```

See `docs/01_SPEC.md` for the product contract and `docs/05_DEVELOPMENT.md` for the contributor
workflow. Redis, background workers, scheduling, and Sentry remain planned capabilities.
