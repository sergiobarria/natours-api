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

Environment variables are parsed by Zod during bootstrap. Invalid ports, log levels, environments, or missing production CORS origins stop startup with a useful error. PostgreSQL, Redis, Stripe, storage, email, workers, and schedulers are future capabilities and are not required for the current application.

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
pnpm test:cov
pnpm test:e2e
pnpm build
```

CI installs the frozen lockfile and runs the non-mutating checks, tests, and build. Run the same sequence before opening a pull request.

## Testing strategy

- Unit tests (`*.spec.ts`) live beside source and cover configuration and isolated behavior.
- End-to-end tests (`test/*.e2e-spec.ts`) boot Nest and use Supertest against the HTTP surface.
- Future persistence integration tests must use isolated PostgreSQL databases rather than in-memory substitutes.
- Future contract checks should generate OpenAPI and compare it with an approved artifact.

Test observable behavior, invalid input, security headers, CORS, request correlation, and error paths. Add concurrency and adapter tests when database and external integrations arrive.

## Contributor workflow

1. Update the relevant product or API contract.
2. Implement the use case behind a narrow controller and service.
3. Add tests proportional to risk.
4. Update OpenAPI decorators and inspect the generated document.
5. Run formatting, linting, type checks, tests, and the production build.
6. Document new environment variables, jobs, integrations, and recovery steps.

Do not document planned scripts as if they already exist. When persistence is introduced, commit generated Drizzle migrations and never rewrite migrations already used by a shared environment.
