# Implementation Backlog

This document converts the committed Natours specifications into eight feature-sized work items. After review, each `F-*` section should become one Linear issue. Keep its checklist in the issue description; do not create a child issue for every checkbox unless implementation later proves that a step must ship independently.

## Delivery map

| Phase | Feature                                              | Depends on         | Contract state                                  |
| ----- | ---------------------------------------------------- | ------------------ | ----------------------------------------------- |
| 1     | F-01 Persistence and Shared API Infrastructure       | Current foundation | Response contract approved                      |
| 1     | F-02 Platform Services and Operational Safeguards    | F-01               | Review required                                 |
| 2     | F-03 Identity and Access Management with Better Auth | F-01, F-02         | Approved architecture; endpoint review required |
| 2     | F-04 Tour Catalog and Guide Teams                    | F-01, F-03         | Endpoint review required                        |
| 2     | F-05 Tour Operations: Departures and Media           | F-02, F-04         | Endpoint review required                        |
| 3     | F-06 Bookings and Stripe Payments                    | F-02 through F-05  | Review required                                 |
| 3     | F-07 Qualified Reviews and Rating Aggregates         | F-03, F-04, F-06   | Endpoint review required                        |
| 3     | F-08 Tour Analytics                                  | F-04 through F-07  | Product definition required                     |

The order expresses dependency, not a requirement to finish an entire phase before starting independent work. Deferred scope in the specification remains excluded from every feature.

## Decisions before Linear

Resolve these questions during backlog review. Update the owning feature and contract document before moving it to Linear.

1. **Health semantics (F-02):** decide whether `/health` becomes dependency-aware readiness or remains liveness beside a new readiness route.
2. **Auth surface (F-03):** enumerate the enabled Better Auth routes and the exact Natours profile/admin endpoints included in OpenAPI.
3. **Booking idempotency (F-06):** name the required header, define its format/retention, and specify replay and conflicting-payload responses.
4. **Analytics (F-08):** define every metric, date boundary, filter, ordering rule, and response resource.

## F-01 Persistence and Shared API Infrastructure

### Objective

Provide the durable PostgreSQL and HTTP contract foundation required by every domain feature.

### Business value

Creates one reliable source of truth for catalog, identity, inventory, and commerce data while preventing each feature from inventing persistence and API conventions independently.

### Scope and subtasks

- [ ] Convert the package and test/build tooling to native ESM; preserve the existing Nest bootstrap, Scalar reference, logging, and CI behavior.
- [ ] Add PostgreSQL and Drizzle configuration with validated `DATABASE_URL`, bounded pooling, graceful shutdown, and dependency-injection access.
- [ ] Adopt UUID v4 for public/domain IDs using native `uuid` columns; provide `crypto.randomUUID()` generation for workflows that need IDs before insertion.
- [ ] Establish shared schema primitives for timezone-aware timestamps, soft deletion, money in integer cents, and conventional foreign-key/index naming.
- [ ] Add reviewed Drizzle generation/migration scripts and verify both fresh-database creation and upgrade from the previous migration.
- [ ] Expose transaction-scoped database access and a repository pattern that supports row locking without leaking Drizzle into controllers.
- [ ] Add isolated PostgreSQL integration-test databases or schemas with deterministic reset and parallel-worker safety.
- [ ] Implement shared success presenters/interceptors for single resources, collections, pagination metadata, and navigation links using the approved `data`/`meta`/`links` contract.
- [ ] Implement a global exception filter for validation, domain, HTTP, and unexpected failures using stable error codes, safe messages/details, and request-ID correlation; preserve documented native-response exceptions.
- [ ] Add deterministic OpenAPI generation/checking and CI verification for the public contract.

### Acceptance criteria

- A fresh PostgreSQL database migrates from zero and a failed transaction rolls back all writes.
- UUID, UTC, money, deletion, index, and constraint conventions are covered by integration tests.
- CI runs migration, contract, unit, integration, e2e, and production-build checks through committed scripts.
- Controllers can depend on application services without importing Drizzle clients directly.
- Every domain endpoint and failure matches the documented envelope, while `204`, Better Auth, health, docs, and stream exceptions remain explicit in OpenAPI/e2e coverage.

### Exclusions

No domain tables beyond those required to validate the infrastructure pattern. No production data migration or deployment is required.

### Specification references

`01_SPEC.md` system requirements; `03_API.md` base/status conventions; `04_ARCHITECTURE.md` persistence and transactions; `05_DEVELOPMENT.md` database/OpenAPI workflow.

## F-02 Platform Services and Operational Safeguards

### Objective

Provide reusable asynchronous, security, audit, and operational capabilities before business workflows depend on them.

### Business value

Makes email, cleanup, payment recovery, sensitive mutations, and production diagnosis durable and observable rather than best-effort side effects.

### Scope and subtasks

- [ ] Add Redis configuration and lifecycle management shared by queues, rate limiting, and distributed coordination.
- [ ] Create independently runnable API, worker, and scheduler entry points from the same build artifact.
- [ ] Implement durable jobs with stable idempotency keys, bounded retries/backoff, failure inspection, and replay support.
- [ ] Define after-commit dispatch and a transactional outbox for work that must survive process failure.
- [ ] Add email and clock injection-token boundaries with deterministic test fakes; implement the configured email provider when identity delivery begins.
- [ ] Add append-only audit persistence with UUID, nullable actor UUID, user/system actor type, action, target type/UUID, request ID, sanitized before/after JSON, and timestamp.
- [ ] Add an explicit audit service used by application use cases; commit required audit records in the same transaction as the mutation and support named system actors for jobs/webhooks.
- [ ] Define typed audit actions for user administration, account security, role, tour, guide-team, departure, and administrative media mutations; centrally redact credentials, session/verification values, secrets, and unnecessary personal data.
- [ ] Add Redis-backed global and route-specific rate-limit primitives keyed by trusted IP or authenticated UUID.
- [ ] Extend health monitoring according to the approved liveness/readiness decision and cover stale/unavailable dependencies.
- [ ] Document job operations, dead-letter recovery, graceful shutdown, retention, and backup expectations.

### Acceptance criteria

- A committed transaction dispatches work once; a rolled-back transaction dispatches nothing.
- Retried jobs and scheduler overlap cannot duplicate their domain effect.
- Every required mutation creates exactly one immutable sanitized audit record; a failed or rolled-back mutation creates none.
- Audit and operational logs contain request context but no credentials, session tokens, or provider secrets.
- Health and rate-limit behavior works consistently across multiple API/worker instances.

### Exclusions

No paid Better Auth Infrastructure, Sentry, full metrics/tracing platform, audit UI/public API, or business-specific job implementation beyond validation fixtures. Audit retention must be documented operationally before automated pruning is enabled.

### Specification references

`01_SPEC.md` asynchronous/security requirements; `02_DOMAIN.md` auditing; `03_API.md` rate limits/caching; `04_ARCHITECTURE.md` jobs/observability; `06_OPERATIONS.md` processes, health, recovery, and security.

## F-03 Identity and Access Management with Better Auth

### Objective

Deliver secure account lifecycle and session authentication through Better Auth while keeping Natours roles and business authorization inside Nest.

### Business value

Enables travelers and operators to safely access protected capabilities without maintaining a custom credential and session system.

### Scope and subtasks

- [x] Integrate Better Auth with the Drizzle PostgreSQL adapter, `generateId: 'uuid'`, a validated URL/secret, and reviewed migrations for user, account, session, and verification tables.
- [x] Mount native Better Auth endpoints under `/api/v1/auth`; configure email/password, required verification, 30-day concurrent sessions, Bearer support, trusted origins, and enumeration-safe recovery.
- [x] Disable automatic body parsing at bootstrap, give Better Auth its required unparsed stream, and restore JSON parsing/DTO validation for normal Nest routes without consuming the future Stripe raw body.
- [x] Integrate the community Nest bridge for global session resolution while explicitly allowing catalog, health, docs, auth, and other public routes.
- [x] Queue verification and recovery messages through the email adapter and test expiry, replay, failure, and non-existent-account behavior.
- [x] Store exactly one application-owned role (`user`, `guide`, `lead-guide`, or `admin`) and define the canonical permission map as typed Nest policy configuration.
- [x] Add permission and ownership guards plus authenticated principal/session access for application services; do not enable Better Auth's admin plugin.
- [x] Implement Natours profile, email/password change, and administrative user endpoints with self-change/delete, session-revocation, rate-limit, no-store, and audit rules. Guide-assignment and booking-history constraints remain at the application-policy boundary until F-04 and F-06 add those records.
- [x] Configure logout to revoke the current session, password reset to revoke every session, and authenticated password change to retain only the current session.
- [x] Document native Better Auth payloads separately in OpenAPI and test the client-facing Bearer flow end to end.

### Acceptance criteria

- Registration, verification, login, session-authenticated request, logout, recovery, reset, and account update flows work through the documented routes.
- No password, recovery/verification value, session token, or Better Auth secret appears in logs, audits, or domain responses.
- One user cannot bypass Natours permission, ownership, or self-administration constraints through Better Auth routes; assignment and booking-history constraints apply when F-04 and F-06 introduce those records.
- Auth schema changes are generated, reviewed, and applied only through Drizzle migrations.

### Exclusions

Social login, passkeys, MFA, refresh tokens, session listing, user revoke-all, organizations, invitations, Better Auth admin/Infrastructure plugins, and richer profiles.

### Specification references

`01_SPEC.md` authentication boundary; `02_DOMAIN.md` users/account lifecycle; `03_API.md` auth/authorization; `04_ARCHITECTURE.md` Better Auth and body parsing; `06_OPERATIONS.md` email/secrets.

## F-04 Tour Catalog and Guide Teams

### Objective

Deliver the public tour catalog and the protected operator workflows that curate tours and guide teams.

### Business value

Lets travelers evaluate active experiences while giving operators controlled catalog and staffing management.

### Scope and subtasks

- [ ] Add tour and guide-assignment schemas with UUID keys, pricing/rating fields, active state, timestamps, and soft deletion.
- [ ] Implement collision-safe generated slugs with numeric suffixes that remain reserved after deletion.
- [ ] Implement permission-protected create, partial update, detail, and soft-delete workflows with audit records.
- [ ] Implement atomic guide-team replacement with one `lead-guide`, zero to four unique `guide` supporters, and no overlap.
- [ ] Prevent incompatible role changes or deletion while assignments exist through identity/application policy integration.
- [ ] Add public active-tour list/detail responses without guide emails, plus `duration_weeks` and ordered future `upcoming_dates`.
- [ ] Implement allow-listed pagination, sorting, text/exact/range filters, sparse fieldsets, optional start-date inclusion, and deterministic links/order.
- [ ] Enforce capacity-aware maximum-group-size updates once departures exist.

### Acceptance criteria

- Public callers see only active, non-deleted tours and safe guide data.
- Administrative writes require the named permissions and produce redacted audits.
- Slug, role/team, soft-delete, query, UTC-derived-field, and capacity invariants have unit/integration/e2e coverage.

### Exclusions

Tour restoration, supplier self-service, richer guide profiles, taxes, promotion codes, multiple currencies, and client-managed media ordering.

### Specification references

`00_BUSINESS.md` operating model; `02_DOMAIN.md` tours/guide teams; `03_API.md` tour queries/routes; `04_ARCHITECTURE.md` module/transaction guidance.

## F-05 Tour Operations: Departures and Media

### Objective

Give operators safe scheduling, inventory initialization, and ordered visual merchandising for each tour.

### Business value

Ensures customers see trustworthy schedules and galleries while preserving capacity and storage consistency.

### Scope and subtasks

- [ ] Add departure schema/lifecycle with UUID keys, UTC start, available/reserved spots, active state, soft deletion, and unique tour/instant constraint including deleted rows.
- [ ] Implement public chronological departure reads and permission-protected create/update/soft-delete workflows.
- [ ] Enforce future/active and capacity invariants, prevent direct reserved-spot mutation, and protect inventory represented by departures.
- [ ] Add media metadata and ordered-position constraints for at most ten images per tour.
- [ ] Implement an S3-compatible `MediaStorage` adapter with deterministic environment-separated keys and test fakes.
- [ ] Validate actual JPEG/PNG/WebP content and 10 MB limits; generate WebP card (1200×800) and thumbnail (480×320) variants.
- [ ] Implement compensated multi-file upload and deletion that removes storage objects safely, deletes metadata, and closes ordering gaps.
- [ ] Add permission checks, audits, public media resources, operational failure logs, and dry-run cleanup safeguards.

### Acceptance criteria

- Concurrent departure changes cannot violate tour capacity or unique schedule constraints.
- Partial upload/conversion/deletion failure cannot silently produce successful inconsistent metadata.
- Public reads return stable ordered media and chronological active departures.
- Storage, content detection, conversion, cleanup, authorization, and deletion visibility are tested.

### Exclusions

Client-controlled reordering, direct browser uploads, queued conversions, deleted-departure restoration, and more than the specified variants.

### Specification references

`02_DOMAIN.md` departures/images; `03_API.md` nested routes; `04_ARCHITECTURE.md` media; `06_OPERATIONS.md` object storage.

## F-06 Bookings and Stripe Payments

### Objective

Implement verified-user booking from atomic capacity hold through payment, expiration, cancellation, and recovery.

### Business value

Allows Natours to sell tours without overselling seats and to recover safely from retries, delayed webhooks, or refund failures.

### Scope and subtasks

- [ ] Add booking, traveler, idempotency, payment, and recovery records with UUID keys, snapshot fields, integer-cent USD money, unique external identifiers, and explicit statuses.
- [ ] Validate verified ownership and traveler roster fields; calculate quantity, discounts, rounding, total, and immutable purchase snapshots.
- [ ] Lock the active future departure and atomically move available spots to reserved under the approved user-scoped idempotency contract.
- [ ] Confirm free bookings immediately; persist recoverable paid state before opening card-only Stripe Checkout with stable idempotency identifiers.
- [ ] Preserve and verify the Stripe raw request body, reject mismatches, lock the booking, and process repeated/out-of-order events idempotently.
- [ ] Expire 30-minute holds through durable scheduled work and restore seats exactly once.
- [ ] Implement owner list/detail and timely full cancellation up to the configured 48-hour cutoff.
- [ ] Complete free cancellation immediately; for paid bookings, use pending/failed states and restore capacity only after confirmed full refund.
- [ ] Add refund reconciliation and hold-expiration operational commands/jobs with bounded retry, inspection, and replay.
- [ ] Apply authentication, ownership, verification, rate limits, no-store headers, audits, and safe logging.

### Acceptance criteria

- Concurrent requests cannot oversell capacity, and idempotent retries cannot create a second hold or Checkout session.
- Browser redirects never confirm payment; only a valid matching webhook does.
- Expiration, webhook replay, cancellation retry, and refund recovery change booking/capacity exactly once.
- Tests cover free/paid flows, money rounding, snapshots, authorization, concurrency, webhook signatures/order, cutoffs, and external failures.

### Exclusions

Guest checkout, amendments, partial refunds, delayed methods, taxes, promotions, multiple currencies, Stripe Connect/customer synchronization, and general admin booking mutation.

### Specification references

`00_BUSINESS.md` booking model; `02_DOMAIN.md` bookings/travelers; `03_API.md` workflows; `04_ARCHITECTURE.md` Stripe state; `06_OPERATIONS.md` Stripe/jobs.

## F-07 Qualified Reviews and Rating Aggregates

### Objective

Allow only customers with a completed qualifying purchase to publish and manage one review per tour.

### Business value

Creates trustworthy social proof and accurate tour ratings without accepting unverified reviews.

### Scope and subtasks

- [ ] Add review schema with UUID key, unique user/tour constraint, rating/text limits, timestamps, and hard deletion.
- [ ] Add public deterministic newest-first tour review listing/detail resources.
- [ ] Require authentication and recheck a confirmed past snapshotted departure inside the creation transaction.
- [ ] Implement author-owned create/update/delete without disclosing other users' protected resources.
- [ ] Lock the tour and recompute count/average transactionally after every mutation, using null/zero for no reviews and two-decimal rounding otherwise.
- [ ] Apply rate limiting, audits where required, safe errors, and OpenAPI coverage.

### Acceptance criteria

- Unqualified, future, unconfirmed, duplicate, or non-owner mutations fail without changing aggregates.
- Concurrent mutations cannot leave rating count/average inconsistent with stored reviews.
- Deleted reviews disappear immediately and recomputation remains correct.

### Exclusions

Moderation, operator-authored reviews, multiple reviews per user/tour, reactions, and soft deletion.

### Specification references

`00_BUSINESS.md` qualified reviews; `02_DOMAIN.md` reviews/ratings; `03_API.md` review routes/workflow; `04_ARCHITECTURE.md` locking flow.

## F-08 Tour Analytics

### Objective

Give authorized operators agreed rankings, statistics, and monthly planning views derived from production domain data.

### Business value

Supports merchandising, staffing, and demand planning without exposing operational data publicly.

### Scope and subtasks

- [ ] Resolve the analytics contract questions before implementation and add the approved definitions to the API/domain specifications.
- [ ] Define permission-protected ranking, aggregate-statistics, and monthly-plan endpoints/resources in OpenAPI.
- [ ] Implement deterministic PostgreSQL queries over active/deleted tours, departures, bookings, cancellations, revenue, capacity, and ratings according to the approved inclusion rules.
- [ ] Apply UTC boundaries, stable ordering, validated filters, sparse output only where approved, and safe empty-result behavior.
- [ ] Add `tours.view-analytics` authorization, bounded query plans/indexes, operational timing logs, and tests against realistic fixtures.

### Acceptance criteria

- Every returned metric can be reproduced from documented source rows and time boundaries.
- Unauthorized callers cannot infer analytics existence or values.
- Empty, boundary-date, cancelled/refunded, deleted-resource, and large-fixture cases match the approved contract and acceptable query plans.

### Exclusions

Guide payouts, commissions, taxes, accounting settlement, custom report builders, exports, dashboards, forecasting, and deeper reporting.

### Specification references

`00_BUSINESS.md` operator value; `01_SPEC.md` planned analytics; `03_API.md` analytics route group; approved contract additions created by this feature.

## Traceability matrix

| Committed capability                                                         | Owning feature |
| ---------------------------------------------------------------------------- | -------------- |
| PostgreSQL, Drizzle, UUIDs, UTC, transactions, migrations, integration tests | F-01           |
| Domain envelopes, validation/errors, OpenAPI generation                      | F-01           |
| Redis, queues, scheduler, outbox, email/clock adapters                       | F-02           |
| Append-only transactional auditing and redaction                             | F-02           |
| Rate limiting, dependency health, operational recovery                       | F-02           |
| Registration, login/logout, verification, recovery, sessions, profile        | F-03           |
| Roles, permissions, ownership, administrative user management                | F-03           |
| Public tour discovery, query capabilities, admin tour lifecycle              | F-04           |
| Guide-team assignments and role compatibility                                | F-04           |
| Departures, capacity initialization, schedule visibility                     | F-05           |
| Gallery upload, conversion, ordering, deletion, cleanup                      | F-05           |
| Booking snapshots, travelers, holds, idempotency, Stripe fulfillment         | F-06           |
| Expiration, cancellation, refunds, reconciliation                            | F-06           |
| Qualified review lifecycle and transactional rating aggregates               | F-07           |
| Rankings, statistics, and monthly plan                                       | F-08           |

## Linear migration checklist

- [ ] Resolve the four remaining review decisions and remove the affected contract-state warnings.
- [ ] Confirm each feature still represents one independently understandable outcome.
- [ ] Copy each `F-*` title, objective, value, scope, acceptance criteria, dependencies, exclusions, and references into one Linear issue.
- [ ] Preserve checklist items inside the issue description rather than creating child issues by default.
- [ ] Add phase/priority labels and dependency links only after all eight issue descriptions are reviewed.
