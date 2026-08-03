# Domain Contract

This document defines Natours' entities, relationships, lifecycle rules, and invariants independently of framework or persistence details.

## Users, roles, and tokens

A user has a UUID v4, name, unique normalized lowercase email, verification state, timestamps, and exactly one application-owned primary role: `user`, `guide`, `lead-guide`, or `admin`. Better Auth owns credential accounts, sessions, and verification records associated with the user; Natours never exposes password hashes.

Canonical user permissions are `users.view-any`, `users.view`, `users.create`, `users.update-role`, and `users.delete`. Tour permissions are `tours.create`, `tours.update`, `tours.delete`, `tours.manage-images`, `tours.manage-start-dates`, and `tours.view-analytics`. Only the canonical administrator role receives them. Self-service behavior is ownership-based.

Better Auth creates concurrent sessions with a 30-day expiration and exposes them to API clients through its Bearer integration. Logout revokes the current session. A successful password reset revokes every session; an authenticated password change preserves the current session and revokes the others. Natours authorization does not use token abilities: permission and ownership guards evaluate the authenticated user.

Administrators cannot change their own role or delete themselves through management endpoints. Guide assignments must be removed before an incompatible role change or deletion. Users with booking history cannot be deleted.

## Tours and guide teams

A tour has a UUID v4, display name, unique generated slug, summary, optional description, duration, maximum group size, difficulty, price, optional percentage discount, rating aggregate, active visibility, timestamps, and soft-delete timestamp.

Difficulty is `easy`, `moderate`, or `difficult`. Names need not be unique. Slugs receive numeric suffixes when necessary, and deleted tours continue reserving their slugs.

Every tour has one lead guide and zero through four unique supporting guides. The lead has the sole `lead-guide` role; supporters have the sole `guide` role; the lead cannot also support the same tour. Public tour resources expose guide IDs and names but never email addresses.

`durationWeeks` is days divided by seven, rounded to one decimal. F-05 adds chronological upcoming
departure dates when departures are implemented; the tour catalog does not expose placeholder
departure data before then.

Soft deletion preserves related records for history. Active guide assignments are ended when a tour
is deleted so they do not permanently block user-role changes. Restoration is not implemented.

## Departures and capacity

A departure has a UUID v4, tour reference, UTC start instant, available spots, reserved spots, active flag, timestamps, and soft-delete timestamp.

Creation and rescheduling require a strictly future instant, including inactive departures. A
departure with reserved inventory cannot be moved, deactivated, or deleted. Public resources omit
reserved inventory and expose only active, future, non-deleted departures.

The tour and normalized UTC instant pair is unique, including soft-deleted records. Available plus reserved spots may never exceed tour capacity. Capacity cannot be reduced below inventory represented by existing departures. `reserved_spots` is internal and changes only through booking workflows.

## Images

A tour has zero through ten ordered images in S3-compatible storage. The first is the cover. Accepted originals are JPEG, PNG, and WebP up to 10 MB. Upload creates WebP `card` (1200×800 centered crop) and `thumbnail` (480×320 centered crop) conversions.

Deleting an image removes originals and conversions and closes the ordering gap. Storage failure must not silently delete only database metadata. Client-controlled reordering is deferred.

Media metadata uses recoverable `pending_upload`, `active`, and `pending_delete` states. Only active
rows are public. Pending deletion immediately removes the public position; metadata remains until
all objects have been confirmed deleted so a failed storage operation can be retried safely.

## Bookings and travelers

A booking belongs to one verified user, tour, and departure. It snapshots tour name, departure instant, purchaser identity, discount, USD unit price, total, and traveler roster. Money is stored in integer cents; discounts round half-up to the nearest cent.

Each traveler has a full name, RFC-valid email, and E.164 phone. Traveler count is quantity. Status is `pending_payment`, `confirmed`, `cancellation_pending`, `cancelled`, `expired`, or `cancellation_failed`.

A user-scoped hash of the required client idempotency key prevents duplicate holds. Booking and external payment identifiers are unique.

Booking creation locks the active future departure and atomically transfers spots from available to reserved. Paid holds last 30 minutes by default and open card-only USD Stripe Checkout. Free bookings confirm immediately. Paid bookings confirm only through a valid matching webhook.

Expired holds restore seats exactly once. Confirmed bookings may be cancelled in full until the configured cutoff, 48 hours before departure by default. Free cancellations complete immediately. Paid cancellations restore seats only after a successful full refund. Failed refunds preserve capacity and remain retryable from the original timely request.

## Reviews and ratings

A review belongs to one user and tour, with an integer rating from 1 through 5 and non-blank text up to 2,000 characters. A user may review each tour once.

Creation requires a confirmed booking for that tour whose snapshotted departure is in the past. Recheck qualification inside the transaction. Only authors may update or delete.

Reviews are hard-deleted. Every mutation locks the tour and recomputes count and average transactionally. An unreviewed tour has a null average and zero count; otherwise the average is rounded to two decimals.

## Account lifecycle

Better Auth registration creates an unverified `user` and invokes the application email adapter to queue its verification link. Better Auth owns token generation, expiration, binding, and idempotent verification behavior.

Email change uses Better Auth's account API, requires the current password at the Natours boundary, normalizes and validates uniqueness, and requires verification of the new address. Submitting the same normalized email preserves verification.

Password recovery preserves an account-enumeration-safe response. Successful reset changes the Better Auth credential and revokes every session. Authenticated password change revokes all other sessions while preserving the current one.

## Auditing and verification

Audit records are append-only and are committed in the same transaction as the mutation they describe. Each record contains a UUID, nullable actor user UUID, actor type (`user` or `system`), action, target type and UUID, request ID when available, sanitized before/after metadata, and timestamp.

Audit user administration, role changes, account security changes, tour mutations, guide-team replacement, departure mutations, and administrative media changes. Jobs and webhooks use a named system actor when they produce an audited mutation. Never store passwords, credential hashes, session tokens, verification/recovery values, provider secrets, or unnecessary personal data. Password changes expose only a marker. Audit history is not mutable through the application.

Tests must cover identity and permissions, UTC and capacity invariants, storage cleanup, booking concurrency and recovery, review qualification and aggregates, account security, deletion visibility, transactional audit creation, and audit secrecy.
