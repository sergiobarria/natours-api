# Development Guide

## Prerequisites and setup

Use Node.js 24 and pnpm 11.18.0, as pinned in `package.json`.

```shell
npm install --global corepack@latest # if `corepack` is unavailable
corepack enable
corepack install
pnpm install --frozen-lockfile
cp .env.example .env
```

Environment variables are parsed by Zod during bootstrap. Invalid ports, log levels, environments,
database URLs, pool bounds, or missing production CORS origins stop startup with a useful error.
Better Auth, Redis, Stripe, storage, email, workers, and schedulers remain future capabilities.

Create dedicated `natours_dev` and `natours_test` PostgreSQL databases when using DBngin. The
optional Compose service runs PostgreSQL on port `5433` and provisions both databases without
conflicting with DBngin's default port.

## Running locally

```shell
pnpm start:dev   # watch mode
pnpm build       # compile to dist/
pnpm start:prod  # run compiled output
```

The API root is `/api/v1`; the version-neutral health probe is `/health`. Scalar API reference (`/docs`) and OpenAPI JSON (`/docs-json`) are disabled in production.

## Quality workflow

```shell
pnpm format        # write Prettier changes
pnpm format:check  # check formatting without mutation
pnpm lint          # check ESLint without mutation
pnpm lint:fix      # apply ESLint fixes explicitly
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:cov
pnpm test:e2e
pnpm build
```

CI installs the frozen lockfile and runs the non-mutating checks, tests, and build. Run the same sequence before opening a pull request.

## Testing strategy

- Unit tests (`*.spec.ts`) live beside source and cover configuration and isolated behavior.
- End-to-end tests (`test/*.e2e-spec.ts`) boot Nest and use Supertest against the HTTP surface.
- Persistence integration tests create isolated PostgreSQL databases per Jest worker from
  `TEST_DATABASE_URL`; the configured database role must be allowed to create databases.
- Future contract checks should generate OpenAPI and compare it with an approved artifact.

Test observable behavior, invalid input, security headers, CORS, request correlation, and error paths. Add concurrency and adapter tests when database and external integrations arrive.

## Contributor workflow

Create feature branches from an up-to-date `dev` branch. Use `codex/sbc-<issue>-<slug>` for Codex
work, open feature pull requests back to `dev`, and promote releases from `dev` to `main` rather
than merging individual features directly into `main`.

1. Update the relevant product or API contract.
2. Implement the use case behind a narrow controller and service.
3. Add tests proportional to risk.
4. Update OpenAPI decorators and inspect the generated document.
5. Run formatting, linting, type checks, tests, and the production build.
6. Document new environment variables, jobs, integrations, and recovery steps.

Generate migrations with `pnpm db:generate -- --name=<name>`, review the SQL and snapshot, and
commit both. Apply them with `pnpm db:migrate`; never rewrite a migration already used by a shared
environment. `pnpm db:check` validates migration history. Direct schema pushes are not part of the
project workflow.

Canonical and demo seed registries are separate and ordered. Extend the appropriate registry as a
feature adds tables. Canonical seeds must remain idempotent; demo seeds must remain deterministic
and local-only. `pnpm db:reset` preserves migration history while rebuilding application data.
Destructive database commands only accept names configured through
`DATABASE_RESET_ALLOWED_DATABASES`; isolated worker databases derived from those names are also
accepted. Production always remains protected.

Better Auth schema generation is an input to the reviewed Drizzle schema, not an alternative migration system. The persistence feature must also convert the package to native ESM and keep unit/e2e tooling compatible with ESM dependencies.
