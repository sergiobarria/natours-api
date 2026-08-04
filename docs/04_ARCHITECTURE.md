# Application Architecture

## Application shape

The target Natours application is a native ESM, modular NestJS TypeScript application. Bootstrap installs native URI versioning below `/api/v1`, Helmet, an environment-driven CORS allowlist, strict global validation, non-production Scalar documentation backed by Nest-generated OpenAPI, structured request logging, and graceful shutdown. `GET /health` is deliberately version-neutral.

Product behavior is authoritative, but framework conventions inherited from an earlier Laravel
design are not. Prefer standard Nest controllers, typed DTOs, guards, and concrete services. Add an
interface, provider boundary, custom query grammar, or future-facing abstraction only when a current
requirement or a second implementation makes its value concrete.

The implemented foundation contains the root module, typed configuration, logging, and `HealthModule`. Organize future capabilities as focused NestJS modules such as `AuthModule`, `UsersModule`, `ToursModule`, `BookingsModule`, and `ReviewsModule`.

- **Controllers** own transport details and response mapping.
- **Request DTOs** validate and document input.
- **Application services/use cases** orchestrate one operation each.
- **Domain services** hold shared business capabilities.
- **Repositories** isolate Drizzle query construction and row mapping.
- **Response presenters** produce stable public resources.
- **Infrastructure adapters** isolate Stripe, email, queue, object storage, hashing, and clock behavior.

Use dependency-injection tokens for real external boundaries. Do not wrap every class in an interface without a substitution need.

## Future Drizzle and PostgreSQL persistence

Define schema modules for Better Auth users, accounts, sessions, and verification records plus application roles, tours, guide assignments, departures, media, bookings, travelers, reviews, audits, idempotency records, outbox/jobs, and health history. Generate and review Better Auth's Drizzle schema, then manage every change through committed Drizzle Kit migrations rather than runtime schema mutation.

Use PostgreSQL constraints for invariants that survive concurrency: unique normalized email, one role per user, unique slugs, unique guide assignments, unique tour/departure instant, one review per user/tour, unique payment identifiers, and idempotency uniqueness. Use check constraints for non-negative capacity and valid money where practical.

Public and domain IDs are UUID v4 values stored in native PostgreSQL `uuid` columns. Generate IDs with `crypto.randomUUID()` before insertion when workflows need the identifier in advance. Configure Better Auth's database ID strategy as `uuid`. Store timestamps as timezone-aware PostgreSQL values and normalize input to UTC.

## Transactions and locking

Expose a transaction boundary from the database layer and pass the transaction-scoped Drizzle client to repositories. Use `SELECT ... FOR UPDATE` through Drizzle's supported locking/query facilities for departure inventory, tour rating aggregates, and other contested rows.

Transactions protect account/role creation, credential mutation and revocation, guide-team replacement, capacity updates, booking state changes, review aggregates, and managed deletion.

Required audit records participate in the same database transaction as their domain mutation. Repositories do not emit audits implicitly; the application use case records an explicit sanitized event so correctness does not depend on subscribers. System jobs and webhooks identify themselves through a named system actor.

Do not enqueue work before commit. Use an after-commit mechanism when execution is in-process, or a transactional outbox when delivery must survive process failure. Workers claim outbox/jobs idempotently.

## Better Auth and application authorization

Better Auth owns email/password credentials, verification, recovery, 30-day concurrent sessions, and Bearer session authentication below `/api/v1/auth`. Use the community-maintained Nest integration to attach Better Auth session and user context. Do not enable Better Auth's admin plugin initially.

Natours owns the user's single primary role and canonical permission map. Permission guards check named permissions; ownership policies load the scoped resource without exposing cross-user existence. Administrative controllers enforce self-management, guide-assignment, booking-history, and auditing constraints rather than exposing unrestricted Better Auth administration routes.

Better Auth is ESM-only and requires access to the unparsed authentication request body. Disable Nest's automatic body parser, mount Better Auth before application JSON parsing, and restore JSON parsing for normal DTO-backed routes. Preserve the future Stripe webhook raw body independently so neither integration weakens global validation.

## Stripe and booking state

`PaymentGateway` is an injection-token boundary; `StripePaymentGateway` implements Checkout session creation, event verification, expiration inspection, refunds, and refund lookup.

Reserve inventory transactionally before creating Checkout. Persist recoverable state and stable idempotency identifiers around external calls. Webhook processing verifies the raw request body before JSON transformation, locks the booking, validates event identity and state, and applies transitions idempotently.

Cancellation uses pending and failed states because refund calls can fail. A scheduled worker reconciles external state without restoring seats more than once.

The implemented payments module provides a provider-neutral `PaymentGateway`; booking application
services do not import Stripe types. `StripePaymentGateway` owns Checkout/refund calls, signatures,
event normalization, idempotency keys, and provider error translation. `FakePaymentGateway` supplies
deterministic sessions and controllable failures. Booking rows carry `inventory_released_at`, and all
terminal release paths lock both booking and departure so inventory moves exactly once.

## Media

The shared `ObjectStorage` boundary abstracts Cloudflare R2's S3-compatible object operations and
has a test fake. Feature modules own their object conventions: tour media validates file count,
size, and detected content type, generates `card` and `thumbnail` WebP conversions, uses
deterministic keys, and compensates uploaded objects when a multi-file operation fails.

Deletion removes storage objects before committing metadata deletion, or records explicit cleanup work when stronger cross-system recovery is needed. Never leave a database-only success that silently orphans objects.

Synchronous uploads reserve hidden metadata before object writes and activate it only after every
variant succeeds. Deletion changes metadata to a hidden pending state and closes the public ordering
gap before object removal. Failures remain retryable through the same delete operation or the
development/test cleanup command; no conversion worker or general media framework is introduced.

## Future queues, jobs, and scheduling

Run API, worker, and scheduler as independently scalable processes. Redis-backed jobs handle email and durable asynchronous work. Scheduled jobs expire booking holds every minute, reconcile refunds every ten minutes, clear expired Better Auth verification records periodically, run readiness checks, and prune operational history.

Every job has a stable idempotency key, bounded retries, exponential backoff where appropriate, structured failure logging, and a dead-letter or failed-job inspection path.

## Observability and flows

`nestjs-pino` emits structured request logs with an accepted or generated `x-request-id`. Local development uses readable output; test and production use JSON. Request bodies are not logged, and sensitive headers and credential fields are redacted centrally. Sentry, metrics, and traces are future integrations. Append-only audit records are durable domain evidence and remain separate from operational logs.

```text
booking request -> validate -> transaction + lock departure -> reserve seats
                -> free: confirm
                -> paid: create Checkout -> signed webhook -> confirm
                -> timeout: expiration job -> restore seats

review request -> authenticate customer -> transaction + lock non-deleted tour
               -> create: verify confirmed past booking snapshot
               -> mutate review -> count + round(avg(rating), 2) -> update tour -> commit
```

Correctness must not depend on optional event subscribers. Keep transport, business rules, persistence, and integrations testable independently.
