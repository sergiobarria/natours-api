# Domain Contract

This document defines Natours' entities, relationships, lifecycle rules, and invariants independently of framework or persistence details.

## Users, roles, and tokens

A user has a ULID, name, unique normalized lowercase email, password hash, optional verification timestamp, and timestamps. Every user has exactly one primary role: `user`, `guide`, `lead-guide`, or `admin`.

Canonical user permissions are `users.view-any`, `users.view`, `users.create`, `users.update-role`, and `users.delete`. Tour permissions are `tours.create`, `tours.update`, `tours.delete`, `tours.manage-images`, `tours.manage-start-dates`, and `tours.view-analytics`. Only the canonical administrator role receives them. Self-service behavior is ownership-based.

Each registration or login creates an access token named `auth-token` with wildcard abilities and a 30-day expiration. Store only a cryptographic hash, return plaintext once, and allow concurrent tokens. Logout revokes the current token; password reset revokes all; authenticated password change preserves only the current token.

Administrators cannot change their own role or delete themselves through management endpoints. Guide assignments must be removed before an incompatible role change or deletion. Users with booking history cannot be deleted.

## Tours and guide teams

A tour has a ULID, display name, unique generated slug, summary, optional description, duration, maximum group size, difficulty, price, optional percentage discount, rating aggregate, active visibility, timestamps, and soft-delete timestamp.

Difficulty is `easy`, `moderate`, or `difficult`. Names need not be unique. Slugs receive numeric suffixes when necessary, and deleted tours continue reserving their slugs.

Every tour has one lead guide and zero through four unique supporting guides. The lead has the sole `lead-guide` role; supporters have the sole `guide` role; the lead cannot also support the same tour. Public tour resources expose guide IDs and names but never email addresses.

`duration_weeks` is days divided by seven, rounded to one decimal. `upcoming_dates` contains ordered active, non-deleted departure instants strictly after now; sold-out departures remain because this describes schedule rather than availability.

Soft deletion preserves departures, reviews, guide assignments, and media. Restoration is not implemented.

## Departures and capacity

A departure has a ULID, tour reference, UTC start instant, available spots, reserved spots, active flag, timestamps, and soft-delete timestamp.

The tour and normalized UTC instant pair is unique, including soft-deleted records. Available plus reserved spots may never exceed tour capacity. Capacity cannot be reduced below inventory represented by existing departures. `reserved_spots` is internal and changes only through booking workflows.

## Images

A tour has zero through ten ordered images in S3-compatible storage. The first is the cover. Accepted originals are JPEG, PNG, and WebP up to 10 MB. Upload creates WebP `card` (1200×800 centered crop) and `thumbnail` (480×320 centered crop) conversions.

Deleting an image removes originals and conversions and closes the ordering gap. Storage failure must not silently delete only database metadata. Client-controlled reordering is deferred.

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

Registration creates an unverified `user` and queues an encrypted verification message after commit. Verification links expire and bind the user to the current email fingerprint. Verification is idempotent.

Email change requires the current password, normalizes and validates uniqueness, clears verification, invalidates reset tokens for old and new addresses, and queues verification after commit. The same normalized email preserves verification.

Password recovery returns a generic response regardless of account existence. Successful reset changes the password and revokes every access token atomically.

## Auditing and verification

Audit user, tour, departure, role, and guide-team changes without storing credentials. Password changes expose only a marker. Tests must cover identity and permissions, UTC and capacity invariants, storage cleanup, booking concurrency and recovery, review qualification and aggregates, account security, deletion visibility, and audit secrecy.
