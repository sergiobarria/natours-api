# Operations Guide

The production build contains independently runnable API, worker, and scheduler entry points with
PostgreSQL persistence and Redis-backed BullMQ jobs. Configuration is validated at startup and
credentials remain outside version control.

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
REDIS_KEY_PREFIX=natours-production
REDIS_CONNECT_TIMEOUT_MS=5000
REDIS_COMMAND_TIMEOUT_MS=5000
REDIS_MAX_RETRIES_PER_REQUEST=1
JOBS_QUEUE_NAME=natours-jobs
JOBS_ATTEMPTS=3
JOBS_BACKOFF_DELAY_MS=1000
JOBS_BACKOFF_JITTER=0.25
JOBS_WORKER_CONCURRENCY=4
JOBS_LOCK_DURATION_MS=30000
JOBS_MAX_STALLED_COUNT=1
JOBS_REMOVE_ON_COMPLETE_AGE_SECONDS=86400
JOBS_REMOVE_ON_COMPLETE_COUNT=1000
JOBS_REMOVE_ON_FAIL_AGE_SECONDS=604800
JOBS_REMOVE_ON_FAIL_COUNT=5000
OUTBOX_POLL_INTERVAL_MS=1000
OUTBOX_BATCH_SIZE=100
PROCESS_SHUTDOWN_TIMEOUT_MS=10000
TRUSTED_PROXY_CIDRS=10.0.0.0/8
RATE_LIMIT_GLOBAL_LIMIT=100
RATE_LIMIT_GLOBAL_TTL_MS=60000
RATE_LIMIT_GLOBAL_BLOCK_MS=60000
RATE_LIMIT_AUTH_LIMIT=10
RATE_LIMIT_AUTH_TTL_MS=60000
RATE_LIMIT_AUTH_BLOCK_MS=300000
RATE_LIMIT_ACCOUNT_LIMIT=30
RATE_LIMIT_ACCOUNT_TTL_MS=60000
RATE_LIMIT_ACCOUNT_BLOCK_MS=60000
RATE_LIMIT_WEBHOOK_LIMIT=120
RATE_LIMIT_WEBHOOK_TTL_MS=60000
RATE_LIMIT_WEBHOOK_BLOCK_MS=60000
READINESS_TIMEOUT_MS=2000
WORKER_HEARTBEAT_INTERVAL_MS=5000
SCHEDULER_HEARTBEAT_INTERVAL_MS=5000
PROCESS_HEARTBEAT_TTL_SECONDS=15
HEALTH_SNAPSHOT_SCHEDULE=*/5 * * * *
OPERATIONS_PRUNE_SCHEDULE=0 3 * * *
HEALTH_HISTORY_RETENTION_DAYS=30
BETTER_AUTH_URL=https://api.example.com
BETTER_AUTH_SECRET=
BETTER_AUTH_TRUSTED_ORIGINS=https://www.example.com
BETTER_AUTH_SESSION_EXPIRES_IN_SECONDS=2592000
BETTER_AUTH_SESSION_UPDATE_AGE_SECONDS=86400
BETTER_AUTH_VERIFICATION_EXPIRES_IN_SECONDS=3600
BETTER_AUTH_PASSWORD_RESET_EXPIRES_IN_SECONDS=3600
BETTER_AUTH_MIN_PASSWORD_LENGTH=8
BETTER_AUTH_MAX_PASSWORD_LENGTH=128
```

Every Redis namespace, queue name, retry policy, concurrency value, retention bound, polling
interval, and timeout is deployment configuration. Never derive namespaces from `NODE_ENV` or
share a Redis prefix between environments. Production startup requires an explicit comma-separated
CORS allowlist.

## Deployment process

1. Install locked dependencies and build TypeScript.
2. Run formatting, linting, type checks, tests, and the build in CI.
3. Review and apply pending Drizzle SQL migrations through a single deployment job.
4. Run idempotent canonical role/permission seeding when required.
5. Deploy API, worker, and scheduler artifacts from the same build.
6. Perform graceful worker replacement and HTTP shutdown.
7. Validate liveness and every integration included in that release. Scheduled readiness, webhooks, queued email, and media checks apply only after those capabilities exist.

Prefer backward-compatible expand/migrate/contract database changes when multiple application versions may overlap. Never run development fixture seeds in production.

## Processes and scheduled work

Deploy `node dist/main.js`, `node dist/worker.js`, and `node dist/scheduler.js` from the same
artifact. At least one worker consumes durable jobs. BullMQ job schedulers are upserted by stable
IDs, so multiple scheduler instances do not duplicate the definition or occurrence.

| Frequency        | Work                                                                       |
| ---------------- | -------------------------------------------------------------------------- |
| Every minute     | Expire checkout holds and run dependency health checks                     |
| Every 10 minutes | Reconcile unresolved booking refunds                                       |
| Every 15 minutes | Remove expired Better Auth verification records                            |
| Daily            | Prune expired sessions, audit/health history according to retention policy |

Jobs use stable IDs, bounded exponential retries, retained failures, and a PostgreSQL effect ledger.
Use `pnpm jobs:list-failed`, `pnpm jobs:inspect --id=<id>`, and
`pnpm jobs:replay --id=<id> --state=failed`. These commands omit payloads and redact failure text.
Investigate the cause before replay; a replay retains the original domain idempotency key.

Bull Board is intentionally deferred until identity and administrative authorization are available.
If introduced, it must be disabled by default, require an explicit administrator permission, and be
restricted at the network edge. Never expose an unauthenticated queue dashboard.

The worker relays committed `outbox_messages` with `FOR UPDATE SKIP LOCKED`. If Redis is unavailable,
the row remains undispatched with bounded error metadata and is retried on the next poll. Never
manually mark a row dispatched. Repair Redis or the invalid job definition, then let the relay
recover it. Process-local after-commit callbacks are best-effort and must not be used for work that
must survive a crash.

## Health and shutdown

- `GET /health` is a version-neutral Terminus liveness probe and performs no external calls.
- Healthy liveness returns `200` using the standard Terminus response.
- `GET /ready` checks bounded PostgreSQL and Redis probes plus fresh, instance-specific worker and
  scheduler heartbeats. One live instance per role satisfies readiness. Dependency outages never
  make liveness fail.

Graceful shutdown hooks stop queue intake and polling, wait up to the configured shutdown bound,
then close BullMQ, Redis, and PostgreSQL connections. Keep the process termination grace period
longer than `PROCESS_SHUTDOWN_TIMEOUT_MS`. Liveness never gains an external dependency.

Configure `TRUSTED_PROXY_CIDRS` only with known proxy networks. Guest rate-limit identity uses
Express's resolved IP and never reads forwarded headers directly. Redis-backed policies are atomic
and fail guarded traffic closed with `503` if Redis is unavailable.

Audit events are inserted through `AuditRecorder` in the same transaction as required mutations.
PostgreSQL rejects update, delete, and truncate operations on `audit_events`; purge/reset preserves
the table. Action allowlists and recursive redaction exclude credentials, secrets, tokens,
verification/recovery values, and unnecessary personal data. Audit history is never automatically
pruned and must follow the required legal and business retention policy.

Dependency history stores only component, status, timestamp, and latency.
`HEALTH_HISTORY_RETENTION_DAYS` controls its idempotent pruning job. Alert on failed readiness,
stale heartbeats, outbox growth, retained failed jobs, and rate-limit storage failures. PostgreSQL
backups must support tested point-in-time recovery. Configure Redis durability for the deployment;
the PostgreSQL outbox remains the source of truth for crash-durable dispatch.

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

Resend is the selected provider. Stage 1 exposes only the `EmailSender` boundary and deterministic
test fake. Identity verification and recovery enqueue `auth.email.deliver` through the PostgreSQL
transactional outbox. The worker calls Resend through `EmailSender` with the stable outbox
idempotency key. Keep `RESEND_API_KEY` in the deployment secret store; retained failures are
inspected and replayed through the existing job commands, which never display email payloads.

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
OBJECT_STORAGE_PROVIDER=r2
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_ENDPOINT=
R2_PUBLIC_URL=https://media.example.com
R2_REGION=auto
```

Use least-privilege Cloudflare R2 credentials and explicit CORS/public-delivery policy. Separate
buckets or prefixes by environment. The application exposes R2 through a generic object-storage
boundary so future features can reuse the provider without inheriting tour-media behavior. Monitor
failed uploads, conversions, deletes, and cleanup jobs.

A cleanup utility must default to dry run, target an explicitly configured development/test bucket, verify deletion before removing metadata, and refuse staging/production regardless of force flags.

Run `pnpm media:cleanup` to inspect recoverable pending media. `pnpm media:cleanup --execute` is
available only when `NODE_ENV` is `development` or `test` and the explicit S3-compatible storage
configuration is present.

## Rate limiting and sensitive data

Use Redis for distributed counters and job coordination. Key guests by trusted client IP and authenticated callers by user UUID. Apply narrower cumulative limits to authentication, recovery, account mutation, and webhooks without bypassing Better Auth's own protections.

Apply no-store headers to sessions and sensitive account or booking data. Redact passwords, confirmations, current passwords, verification/recovery tokens, authorization headers, cookie values, Better Auth secrets, session tokens, Stripe secrets, storage credentials, and database URLs from logs, traces, error reporting, and audit records.

## Backup and recovery

Automate PostgreSQL backups and regularly test point-in-time recovery; the outbox and job-effect
ledger are part of that recovery set. Enable Redis persistence appropriate to the deployment and
understand that PostgreSQL remains the source of truth for undispatched durable work. Losing Redis
may lose queued-but-not-yet-processed copies, so reconcile undispatched/outstanding work through
the outbox and domain recovery jobs after restoration. Retain completed/failed BullMQ records only
within the configured age/count bounds.

## Security checklist

- Enforce HTTPS and trusted proxy/host configuration.
- Rotate database, Redis, Stripe, email, storage, and token-pepper secrets deliberately.
- Keep administrative writes behind Bearer authentication and named permissions.
- Validate all input and file content; reject unknown fields.
- Keep dependencies and container images patched.
- Restrict OpenAPI UI exposure according to organizational policy.
- Test backup restoration, webhook replay, job recovery, and graceful deployment before launch.
