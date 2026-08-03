# Natours API Specification

## Purpose

This document is the entry point to Natours' living product and engineering contract. The generated OpenAPI document owns exhaustive HTTP schemas. Markdown owns business intent, cross-cutting behavior, domain invariants, workflows, and operating requirements.

## Current capabilities

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
- Application-owned records use ULIDs. Infrastructure tables may use implementation-appropriate identifiers; tour image operations may expose integer media IDs.
- Version 1 is mounted under `/api/v1`.
- UTC is canonical for stored and transmitted instants. Timestamps use ISO 8601 with an explicit offset.
- Resource responses follow the project's JSON:API-style representation. Writes use top-level JSON except multipart image uploads.
- Controllers remain transport-focused; application services implement use cases; repositories isolate Drizzle queries; stable boundaries use typed DTOs.
- Required workflows use direct orchestration. Correctness may not depend on optional event handlers.
- Cross-record invariants are transactional. Asynchronous work is enqueued only after commit or through a transactional outbox.
- Tours and departures are soft-deleted. Reviews and individual media are hard-deleted through explicit workflows.
- Authentication uses hashed Bearer tokens. Authorization uses permissions or ownership policies rather than role-name conditionals.
- External input is validated, unknown write fields are rejected, and sensitive responses are not cached.

## Contract documents

| Document                           | Contract owned                                  |
| ---------------------------------- | ----------------------------------------------- |
| [Business](00_BUSINESS.md)         | Fictional company and product context           |
| [Domain](02_DOMAIN.md)             | Entities, lifecycle rules, and invariants       |
| [API](03_API.md)                   | HTTP behavior, errors, and workflows            |
| [Architecture](04_ARCHITECTURE.md) | NestJS structure, persistence, and integrations |
| [Development](05_DEVELOPMENT.md)   | Setup, testing, and migrations                  |
| [Operations](06_OPERATIONS.md)     | Deployment, health, jobs, and maintenance       |

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
