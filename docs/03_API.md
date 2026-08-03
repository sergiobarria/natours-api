# API Behavior

The Scalar API reference at `/docs` renders the same OpenAPI document exposed as JSON at `/docs-json`; the JSON document is authoritative for request and response schemas. Both are available outside production. This document owns conventions and workflows.

## Base conventions

- Version 1 is served below `/api/v1`.
- `GET /health` is an unversioned infrastructure endpoint and is excluded from OpenAPI.
- Clients may send `x-request-id`; the API returns the accepted ID or a generated UUID.
- JSON clients send `Accept: application/json`; writes use top-level JSON.
- Images use `multipart/form-data`.
- Domain responses use the standard success or error envelope defined below. Resource fields remain flat inside `data`; the API does not implement JSON:API.
- Public and domain application IDs are UUID v4 strings.
- Timestamps are ISO 8601 UTC values.
- `PATCH` performs partial updates. Unknown fields and empty patches fail validation.
- A global validation pipe transforms and validates DTOs, strips no data silently, rejects non-whitelisted properties, and raises `400` validation failures for the global exception filter.

## Response envelopes

Successful domain endpoints wrap their payload in `data`. Resource fields are flat and endpoint-specific:

```json
{
  "data": {
    "id": "ea75946a-97e8-4a5f-8250-e1ba767968b1",
    "name": "The Forest Hiker",
    "price": 49700
  }
}
```

Non-paginated collections use the same shape with an array. Paginated collections always include pagination metadata and navigation links:

```json
{
  "data": [],
  "meta": {
    "pagination": {
      "page": 2,
      "perPage": 20,
      "totalItems": 74,
      "totalPages": 4
    }
  },
  "links": {
    "self": "/api/v1/tours?page=2&per_page=20",
    "first": "/api/v1/tours?page=1&per_page=20",
    "last": "/api/v1/tours?page=4&per_page=20",
    "previous": "/api/v1/tours?page=1&per_page=20",
    "next": "/api/v1/tours?page=3&per_page=20"
  }
}
```

`previous` and `next` are `null` at their respective boundaries. `meta` may contain endpoint-specific non-resource information in addition to `pagination`; `links` is reserved for navigation. Create and update responses return the affected resource in `data`. Successful delete and other intentionally empty operations return `204` with no body.

All domain failures use one machine-readable envelope:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request contains invalid fields.",
    "details": [
      {
        "field": "travelers.0.email",
        "code": "INVALID_EMAIL",
        "message": "Email must be a valid address."
      }
    ],
    "requestId": "7cb18e9f-2787-4740-913a-8efc5a68c11b"
  }
}
```

`error.code` and detail codes are stable uppercase snake-case identifiers. `message` is safe for display but is not a programmatic contract. `details` is optional; validation errors use field paths, while domain errors may include non-field details. Unexpected failures return `INTERNAL_SERVER_ERROR` without internal messages or stack traces. The response repeats the `x-request-id` value in errors for support correlation.

These envelopes do not apply to Better Auth's native `/api/v1/auth/*` responses, the Terminus `/health` response, Scalar/OpenAPI documents, file streams, or empty `204` responses. OpenAPI must describe each exception explicitly.

## Authentication and authorization

```http
Authorization: Bearer <token>
```

Better Auth is mounted at `/api/v1/auth` and owns registration, login, logout, verification, password recovery, and session payloads. Its Bearer plugin accepts the session token in this header. The Nest integration resolves the session and authenticated user; application permission and ownership guards enforce Natours capabilities.

Catalog, departure, and review reads are public. Review writes require authentication and ownership. Bookings require a verified owner. User management, tour mutations, gallery/departure management, and analytics require their named permissions.

Authorization precedes validation and target disclosure on administrative operations. Invalid authentication returns `401`; insufficient capability returns `403`; incorrectly nested resources return `404`.

## Query conventions

Tour listing supports pagination, allow-listed sorting, text/exact/range filters, sparse fieldsets, and optional `startDates` inclusion:

```http
GET /api/v1/tours?sort=price,-rating_avg&per_page=15&page=2
GET /api/v1/tours?filter[difficulty]=moderate&filter[price][from]=500&filter[price][to]=1500
GET /api/v1/tours?fields[tours]=name,slug,price
GET /api/v1/tours?include=startDates&fields[tour_start_dates]=start_datetime_utc,available_spots
```

`id` remains with sparse fieldsets. Unsupported or malformed filters, sorts, includes, and values return `400`. Pagination links retain the complete active query. Review order is deterministic and newest-first; departures are chronological.

## Endpoint groups

| Group          | Routes                        | Access and purpose                                                    |
| -------------- | ----------------------------- | --------------------------------------------------------------------- |
| Authentication | `/auth/*`                     | Native Better Auth registration, sessions, password, and verification |
| Users          | `/users/*`                    | Permission-protected user administration                              |
| Tours          | `/tours`, `/tours/{tour}`     | Public catalog reads and protected writes                             |
| Images         | `/tours/{tour}/images/*`      | Protected gallery management                                          |
| Departures     | `/tours/{tour}/start-dates/*` | Public reads and protected writes                                     |
| Reviews        | `/tours/{tour}/reviews/*`     | Public reads and qualified/owned writes                               |
| Bookings       | `/bookings/*`                 | Verified owner create, list, detail, and cancellation                 |
| Stripe webhook | `/stripe/webhook`             | Signed event ingestion with a dedicated limit                         |
| Analytics      | `/tour-analytics/*`           | Protected rankings, statistics, and monthly plan                      |

## Stateful workflows

Better Auth invokes the queued email adapter for verification and recovery delivery. Account-recovery responses remain generic, and session revocation follows the domain contract. Natours profile and administrative endpoints remain regular Nest controllers.

Booking creation requires a schema-defined idempotency header and traveler roster. Free totals confirm immediately; paid totals return pending booking and Checkout data. Browser redirects never prove fulfillment. Only a signed matching webhook confirms payment. Repeated booking requests and webhook events are safe.

Review creation requires a confirmed purchased departure in the past. Updates and deletes require ownership. Tour and departure deletion is soft deletion; deleted resources disappear from normal binding while history remains.

## Status and errors

- `200`: successful domain read or update.
- `201`: successful domain creation.
- `202`: generic password-reset acceptance.
- `204`: successful no-content mutation.
- `400`: malformed input, validation failure, or unsupported query capability.
- `401`: missing, malformed, expired, or revoked token.
- `403`: missing permission or ownership.
- `404`: unknown, deleted, inactive where applicable, or wrongly nested resource.
- `405`: unregistered method.
- `422`: domain-rule failure when an endpoint defines that distinction.
- `429`: rate limit or credential lockout.

One global exception filter maps Nest HTTP exceptions, validation failures, domain failures, and unexpected errors into the standard domain error envelope. Credential flows must not reveal whether an email exists.

Better Auth endpoints use their native status codes and error bodies. The generated OpenAPI contract must document this boundary rather than rewriting Better Auth responses into the domain envelope.

## Rate limits and caching

Apply a global API limiter, plus narrower cumulative limits for registration, login, verification, account updates, password recovery, and Stripe events. Guests are keyed by IP and authenticated callers by user UUID. Store distributed counters in Redis and coordinate the policy with Better Auth's authentication-specific limiter.

Sensitive responses use `Cache-Control: no-store, private` and `Pragma: no-cache`. Logs and tracing redact credentials, authorization headers, session tokens, and verification/recovery values.
