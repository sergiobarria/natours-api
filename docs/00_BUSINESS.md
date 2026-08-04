# Natours Business

> Natours and this history are fictional. This document supplies consistent product context; it does not claim real customers, revenue, or operations.

## Origin

Natours began after its founders repeatedly found remarkable local guides difficult to discover while travelers had little confidence that schedules, capacity, quality, and guide identities were current. The fictional company was formed to make guided travel easier to evaluate and book.

Its first product is a curated marketplace where travelers discover experiences, choose departures, pay for a party, and review a tour after traveling. Natours' operating team uses the platform to assemble guide teams, maintain media and schedules, and understand demand.

## Customers and partners

- **Travelers** want trustworthy descriptions, clear prices, real availability, secure payment, and qualified reviews.
- **Guides** want relevant demand and an accurate representation of their experiences. Lead guides own delivery accountability; supporting guides add capacity and expertise.
- **Natours operators** curate the catalog, manage staffing and departures, monitor bookings, and use analytics for planning.

Natours is currently the merchant and catalog operator. It is not yet a supplier self-service marketplace.

## Value proposition

- Structured tour details and ordered galleries improve purchase confidence.
- Capacity holds prevent overselling during checkout.
- Booking snapshots preserve what the customer purchased.
- Reviews require a confirmed past purchase and are limited to one per customer and tour,
  strengthening rating trust.
- Operators receive a consistent view of schedules, ratings, demand, and guide assignments.

## Business model

The intended model is a commission or margin retained from completed bookings. The application records the traveler-facing USD total and uses Natours' Stripe account, but it does not calculate commissions, guide payouts, taxes, or accounting settlement.

Discounts are merchandising tools and are snapshotted at purchase time so later catalog changes cannot alter existing bookings.

## Operating model

1. An administrator creates a tour, assigns guides, uploads media, and publishes departures.
2. Travelers browse active tours, schedules, prices, capacity, ratings, and guide teams.
3. A verified traveler submits a roster. Natours reserves seats and opens Stripe Checkout, or confirms a free booking immediately.
4. A signed Stripe webhook confirms paid bookings. Expired holds return seats.
5. Timely cancellations request full refunds; seats return only after success.
6. After a confirmed departure is in the past, the purchaser may review the tour once.
7. Operators use rankings, statistics, and monthly plans for merchandising and staffing.

## Product controls

Departures isolate inventory; guide teams establish accountability; verified identities support booking and recovery; signed webhooks prove payment; idempotency protects retries; qualified reviews improve trust; ordered media supports merchandising; permissions and audits protect sensitive changes; analytics support planning.

## Current stage and future direction

Natours is an early operational product with curated supply. It still depends on a separate frontend, customer-support processes, external financial reconciliation, infrastructure monitoring, and credential management.

Potential future work includes supplier self-service, richer guide profiles, multiple currencies, taxes, promotion codes, guest checkout, amendments, partial refunds, waitlists, gallery reordering, payouts, and deeper reporting. These are opportunities rather than committed features.
