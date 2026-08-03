# Application Architecture

## Application shape

Natours is a modular NestJS TypeScript application. Bootstrap installs native URI versioning below `/api/v1`, Helmet, an environment-driven CORS allowlist, strict global validation, non-production Scalar documentation backed by Nest-generated OpenAPI, structured request logging, and graceful shutdown. `GET /health` is deliberately version-neutral.

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

Define schema modules for users, roles, permissions, access tokens, tours, guide assignments, departures, media, bookings, travelers, reviews, audits, idempotency records, reset tokens, and health history. Generate SQL migrations with Drizzle Kit and commit them.

Use PostgreSQL constraints for invariants that survive concurrency: unique normalized email, one role per user, unique slugs, unique guide assignments, unique tour/departure instant, one review per user/tour, unique payment identifiers, and idempotency uniqueness. Use check constraints for non-negative capacity and valid money where practical.

Application-owned IDs are ULIDs generated before insertion. Store timestamps as timezone-aware PostgreSQL values and normalize input to UTC.

## Transactions and locking

Expose a transaction boundary from the database layer and pass the transaction-scoped Drizzle client to repositories. Use `SELECT ... FOR UPDATE` through Drizzle's supported locking/query facilities for departure inventory, tour rating aggregates, and other contested rows.

Transactions protect account/role creation, credential mutation and revocation, guide-team replacement, capacity updates, booking state changes, review aggregates, and managed deletion.

Do not enqueue work before commit. Use an after-commit mechanism when execution is in-process, or a transactional outbox when delivery must survive process failure. Workers claim outbox/jobs idempotently.

## Authentication and authorization

Generate high-entropy opaque access tokens, return plaintext once, and store a keyed cryptographic hash plus name, expiration, last-use metadata, and owner. A Bearer guard resolves the token and attaches the authenticated principal.

Permission guards check canonical permission strings. Ownership policies are application services or guards that load the scoped resource without exposing cross-user existence. Passwords use a memory-hard password hashing algorithm with production-calibrated settings.

## Stripe and booking state

`PaymentGateway` is an injection-token boundary; `StripePaymentGateway` implements Checkout session creation, event verification, expiration inspection, refunds, and refund lookup.

Reserve inventory transactionally before creating Checkout. Persist recoverable state and stable idempotency identifiers around external calls. Webhook processing verifies the raw request body before JSON transformation, locks the booking, validates event identity and state, and applies transitions idempotently.

Cancellation uses pending and failed states because refund calls can fail. A scheduled worker reconciles external state without restoring seats more than once.

## Media

`MediaStorage` abstracts S3-compatible object operations. Validate file count, size, and detected content type. Generate `card` and `thumbnail` WebP conversions with a Node-compatible image processor. Use deterministic object keys and compensate uploaded objects when a multi-file operation fails.

Deletion removes storage objects before committing metadata deletion, or records explicit cleanup work when stronger cross-system recovery is needed. Never leave a database-only success that silently orphans objects.

## Future queues, jobs, and scheduling

Run API, worker, and scheduler as independently scalable processes. Redis-backed jobs handle email and durable asynchronous work. Scheduled jobs expire booking holds every minute, reconcile refunds every ten minutes, clear reset tokens periodically, run readiness checks, and prune operational history.

Every job has a stable idempotency key, bounded retries, exponential backoff where appropriate, structured failure logging, and a dead-letter or failed-job inspection path.

## Observability and flows

`nestjs-pino` emits structured request logs with an accepted or generated `x-request-id`. Local development uses readable output; test and production use JSON. Request bodies are not logged, and sensitive headers and credential fields are redacted centrally. Sentry, metrics, and traces are future integrations; audit sensitive domain mutations separately from operational logs.

```text
booking request -> validate -> transaction + lock departure -> reserve seats
                -> free: confirm
                -> paid: create Checkout -> signed webhook -> confirm
                -> timeout: expiration job -> restore seats

review request -> verify past confirmed purchase -> transaction + lock tour
               -> mutate review -> recompute aggregate -> commit
```

Correctness must not depend on optional event subscribers. Keep transport, business rules, persistence, and integrations testable independently.
