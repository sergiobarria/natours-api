# Natours API Specification

## Purpose

This document is the entry point to Natours' living product and engineering contract. The generated OpenAPI document owns exhaustive HTTP schemas. Markdown owns business intent, cross-cutting behavior, domain invariants, workflows, and operating requirements.

## Planned capabilities

The application currently provides only its NestJS foundation. The following capabilities define the committed implementation backlog:

- Registration, login, logout, email verification, password recovery, and account updates.
- One primary role per user with permission-based administration.
- Public tour discovery with filtering, sorting, pagination, fieldsets, and departure inclusion.
- Administrative tour, guide-team, gallery, and departure management.
- Verified-user bookings, Stripe fulfillment, expiring holds, cancellation, and refund reconciliation.
- Purchase-qualified reviews with transactional rating aggregation.
- Administrative rankings, statistics, and monthly planning.
- Auditing, rate limiting, readiness checks, queues, and scheduled cleanup.

## System-wide requirements

- The implementation uses TypeScript and NestJS. Drizzle ORM and PostgreSQL are the planned persistence stack and are not installed yet.
- Public and domain records use UUID v4 values stored in native PostgreSQL `uuid` columns. Internal infrastructure records may use implementation-appropriate identifiers.
- Version 1 is mounted under `/api/v1`.
- UTC is canonical for stored and transmitted instants. Timestamps use ISO 8601 with an explicit offset.
- Domain endpoints use the shared `data`/`meta`/`links` success envelope and `error` failure envelope defined in the API contract. Better Auth's native `/api/v1/auth/*` contract is an explicit exception. Domain writes use top-level JSON except multipart image uploads.
- Controllers remain transport-focused; application services implement use cases; repositories isolate Drizzle queries; stable boundaries use typed DTOs.
- Required workflows use direct orchestration. Correctness may not depend on optional event handlers.
- Cross-record invariants are transactional. Asynchronous work is enqueued only after commit or through a transactional outbox.
- Tours and departures are soft-deleted. Reviews and individual media are hard-deleted through explicit workflows.
- Better Auth owns credentials, verification, recovery, sessions, and Bearer authentication. Nest owns the single application role, permissions, ownership policies, administrative constraints, and audits.
- External input is validated, unknown write fields are rejected, and sensitive responses are not cached.

## Contract documents

| Document                                | Contract owned                                  |
| --------------------------------------- | ----------------------------------------------- |
| [Business](00_BUSINESS.md)              | Fictional company and product context           |
| [Domain](02_DOMAIN.md)                  | Entities, lifecycle rules, and invariants       |
| [API](03_API.md)                        | HTTP behavior, errors, and workflows            |
| [Architecture](04_ARCHITECTURE.md)      | NestJS structure, persistence, and integrations |
| [Development](05_DEVELOPMENT.md)        | Setup, testing, and migrations                  |
| [Operations](06_OPERATIONS.md)          | Deployment, health, jobs, and maintenance       |
| [Backlog](07_IMPLEMENTATION_BACKLOG.md) | Dependency-ordered implementation features      |

## Documentation policy

Feature changes update their contract documents and generated OpenAPI in the same implementation. Do not duplicate full schemas in Markdown. When code, tests, and documentation disagree, resolve the discrepancy rather than documenting both behaviors.

## Deferred scope

- Restoring soft-deleted tours or departures.
- Refresh tokens, token listing, and user-initiated revoke-all.
- Client-controlled image reordering, direct uploads, and queued conversions.
- Guest checkout, amendments, partial refunds, taxes, promotions, multiple currencies, delayed payment methods, Stripe Connect, and customer synchronization.
- Administrative booking operations beyond recovery jobs.
- Invitation-specific onboarding and richer public profiles.

Every deferred capability requires explicit domain and API design before implementation.
