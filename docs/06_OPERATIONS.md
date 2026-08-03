# Operations Guide

The current production artifact is the NestJS HTTP API with PostgreSQL persistence through a
bounded Drizzle/node-postgres pool. Configuration is validated at startup and credentials remain
outside version control. Redis, workers, and schedulers described below remain target capabilities.

## Environment baseline

```dotenv
NODE_ENV=production
APP_URL=https://api.example.com
FRONTEND_URL=https://www.example.com
HOST=0.0.0.0
PORT=3000
LOG_LEVEL=info
CORS_ORIGINS=https://www.example.com
DATABASE_URL=postgresql://...
DATABASE_POOL_MAX=10
DATABASE_POOL_IDLE_TIMEOUT_MS=30000
DATABASE_POOL_CONNECTION_TIMEOUT_MS=5000
REDIS_URL=redis://...
BETTER_AUTH_URL=https://api.example.com
BETTER_AUTH_SECRET=
```

`DATABASE_URL` and the bounded pool settings are implemented alongside the HTTP configuration.
Production startup requires an explicit comma-separated CORS allowlist. Add and validate the
remaining variables alongside their integrations. Better Auth secrets require at least 32
high-entropy characters and deliberate rotation procedures.

## Deployment process

1. Install locked dependencies and build TypeScript.
2. Run formatting, linting, type checks, tests, and the build in CI.
3. Review and apply pending Drizzle SQL migrations through a single deployment job.
4. Run idempotent canonical role/permission seeding when required.
5. Deploy API, worker, and scheduler artifacts from the same build.
6. Perform graceful worker replacement and HTTP shutdown.
7. Validate liveness and every integration included in that release. Scheduled readiness, webhooks, queued email, and media checks apply only after those capabilities exist.

Prefer backward-compatible expand/migrate/contract database changes when multiple application versions may overlap. Never run development fixture seeds in production.

## Future processes and scheduled work

At least one worker consumes durable jobs. Exactly one logical scheduler execution should enqueue each occurrence; use a distributed lock or a platform scheduler with concurrency control.

| Frequency        | Work                                                                       |
| ---------------- | -------------------------------------------------------------------------- |
| Every minute     | Expire checkout holds and run dependency health checks                     |
| Every 10 minutes | Reconcile unresolved booking refunds                                       |
| Every 15 minutes | Remove expired Better Auth verification records                            |
| Daily            | Prune expired sessions, audit/health history according to retention policy |

Jobs are idempotent, use bounded retries and backoff, emit structured failures, and expose dead-letter inspection and replay procedures.

## Health and shutdown

- `GET /health` is a version-neutral Terminus liveness probe and performs no external calls.
- Healthy liveness returns `200` using the standard Terminus response.
- Add dependency indicators and, if needed, a distinct readiness route when PostgreSQL or Redis is implemented.

Graceful shutdown hooks close the PostgreSQL pool. Future readiness checks should be bounded and
should not make the liveness route dependent on external systems.

Domain responses use the documented success/error envelopes. Unexpected exceptions are logged
with internal context while clients receive only a safe `INTERNAL_SERVER_ERROR` response and the
correlated request ID. Health, OpenAPI/Scalar, file streams, and explicitly native contracts remain
outside the envelope.

Monitor latency and errors, PostgreSQL pool saturation and locks, Redis availability, job age/failures, scheduler execution, Stripe webhook lag/failures, unresolved booking states, storage errors, and memory/event-loop health.

## Email

```dotenv
EMAIL_PROVIDER=resend
RESEND_API_KEY=
MAIL_FROM_ADDRESS=hello@example.com
MAIL_FROM_NAME=Natours
```

Use a verified sending domain. `FRONTEND_URL` receives password and verification handoffs; `APP_URL` and `BETTER_AUTH_URL` identify the API origin while Better Auth uses `/api/v1/auth` as its configured base path. Queue messages with no plaintext passwords, session tokens, or unnecessary personal data. Monitor provider errors and queue failures without changing generic account-enumeration-safe responses.

## Stripe

```dotenv
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CURRENCY=usd
STRIPE_CHECKOUT_HOLD_MINUTES=30
BOOKING_CANCELLATION_CUTOFF_HOURS=48
```

Register `POST ${APP_URL}/api/v1/stripe/webhook`. Preserve the raw request body for signature verification before parsing. The webhook is the fulfillment authority.

Provide idempotent operational commands or admin jobs equivalent to:

```shell
pnpm bookings:expire-holds
pnpm bookings:reconcile-refunds
```

Investigate Stripe and queue state before manual recovery. Seat restoration remains exactly once.

## Object storage

```dotenv
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_ENDPOINT=
R2_PUBLIC_URL=https://media.example.com
R2_REGION=auto
```

Use least-privilege bucket credentials and explicit CORS/public-delivery policy. Separate buckets or prefixes by environment. Monitor failed uploads, conversions, deletes, and cleanup jobs.

A cleanup utility must default to dry run, target an explicitly configured development/test bucket, verify deletion before removing metadata, and refuse staging/production regardless of force flags.

## Rate limiting and sensitive data

Use Redis for distributed counters and job coordination. Key guests by trusted client IP and authenticated callers by user UUID. Apply narrower cumulative limits to authentication, recovery, account mutation, and webhooks without bypassing Better Auth's own protections.

Apply no-store headers to sessions and sensitive account or booking data. Redact passwords, confirmations, current passwords, verification/recovery tokens, authorization headers, cookie values, Better Auth secrets, session tokens, Stripe secrets, storage credentials, and database URLs from logs, traces, error reporting, and audit records.

## Backup and recovery

Automate PostgreSQL backups and regularly test point-in-time recovery. Define retention for audits, sessions, verification records, health history, and job records. Object-storage versioning or lifecycle policy should match business recovery requirements. Document recovery for database loss, Redis loss, missed scheduled jobs, delayed webhooks, and partially completed media operations.

## Security checklist

- Enforce HTTPS and trusted proxy/host configuration.
- Rotate database, Redis, Stripe, email, storage, and token-pepper secrets deliberately.
- Keep administrative writes behind Bearer authentication and named permissions.
- Validate all input and file content; reject unknown fields.
- Keep dependencies and container images patched.
- Restrict OpenAPI UI exposure according to organizational policy.
- Test backup restoration, webhook replay, job recovery, and graceful deployment before launch.
