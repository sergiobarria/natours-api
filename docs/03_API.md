# API Behavior

The Scalar API reference at `/docs` renders the same OpenAPI document exposed as JSON at `/docs-json`; the JSON document is authoritative for request and response schemas. Both are available outside production. This document owns conventions and workflows.

## Base conventions

- Version 1 is served below `/api/v1`.
- `GET /health` is an unversioned infrastructure endpoint and is excluded from OpenAPI.
- Clients may send `x-request-id`; the API returns the accepted ID or a generated UUID.
- JSON clients send `Accept: application/json`; writes use top-level JSON.
- Images use `multipart/form-data`.
- Responses contain `type`, `id`, and `attributes` in the project's JSON:API-style representation.
- Application IDs are ULIDs; tour image IDs may be integers.
- Timestamps are ISO 8601 UTC values.
- `PATCH` performs partial updates. Unknown fields and empty patches fail validation.
- A global validation pipe transforms and validates DTOs, strips no data silently, rejects non-whitelisted properties, and returns Nest's standard `400` response when validation fails.

## Authentication and authorization

```http
Authorization: Bearer <token>
```

Registration and login return a user resource and one-time plaintext token. Logout revokes only the current token. An authentication guard validates the token hash and expiration; permission and ownership guards enforce application capabilities.

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

`id` and `type` remain with sparse fieldsets. Unsupported or malformed filters, sorts, includes, and values return `400`. Pagination links retain the active query. Review order is deterministic and newest-first; departures are chronological.

## Endpoint groups

| Group          | Routes                        | Access and purpose                                          |
| -------------- | ----------------------------- | ----------------------------------------------------------- |
| Authentication | `/auth/*`                     | Registration, sessions, password, verification, and profile |
| Users          | `/users/*`                    | Permission-protected user administration                    |
| Tours          | `/tours`, `/tours/{tour}`     | Public catalog reads and protected writes                   |
| Images         | `/tours/{tour}/images/*`      | Protected gallery management                                |
| Departures     | `/tours/{tour}/start-dates/*` | Public reads and protected writes                           |
| Reviews        | `/tours/{tour}/reviews/*`     | Public reads and qualified/owned writes                     |
| Bookings       | `/bookings/*`                 | Verified owner create, list, detail, and cancellation       |
| Stripe webhook | `/stripe/webhook`             | Signed event ingestion with a dedicated limit               |
| Analytics      | `/tour-analytics/*`           | Protected rankings, statistics, and monthly plan            |

## Stateful workflows

Registration queues verification after commit. Password-reset requests return a generic accepted response; successful reset and authenticated password change return no content.

Booking creation requires a schema-defined idempotency header and traveler roster. Free totals confirm immediately; paid totals return pending booking and Checkout data. Browser redirects never prove fulfillment. Only a signed matching webhook confirms payment. Repeated booking requests and webhook events are safe.

Review creation requires a confirmed purchased departure in the past. Updates and deletes require ownership. Tour and departure deletion is soft deletion; deleted resources disappear from normal binding while history remains.

## Status and errors

- `200`: successful read, login, or update.
- `201`: registration or creation.
- `202`: generic password-reset acceptance.
- `204`: successful no-content mutation.
- `400`: malformed input, validation failure, or unsupported query capability.
- `401`: missing, malformed, expired, or revoked token.
- `403`: missing permission or ownership.
- `404`: unknown, deleted, inactive where applicable, or wrongly nested resource.
- `405`: unregistered method.
- `422`: domain-rule failure when an endpoint defines that distinction.
- `429`: rate limit or credential lockout.

Nest's standard exception response is the current error contract. A custom domain error envelope may be introduced when feature requirements justify it. Credential flows must not reveal whether an email exists.

## Rate limits and caching

Apply a global API limiter, plus narrower cumulative limits for registration, login, verification, account updates, password recovery, and Stripe events. Guests are keyed by IP and authenticated callers by user ULID. Store distributed counters in Redis.

Sensitive responses use `Cache-Control: no-store, private` and `Pragma: no-cache`. Logs and tracing redact credentials, authorization headers, reset tokens, and plaintext tokens.
