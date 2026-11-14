# Day-Use and Exclusive-Event Bookings: Status

**Status: deferred. The team will resume and complete this feature in December 2026.**

This branch (`feat/day-use-bookings`) holds the work in progress. It is kept off
`main` on purpose so that `main` reflects the system as submitted before December.

## Rules until December 2026

- Do not merge this branch into `main`, and do not copy its code, migrations, or docs
  into `main` or other branches.
- Do not apply `20261110_add_day_use_and_event_bookings.sql` to the deployed database.
- AI agents must follow these rules too (see `AGENTS.md`).

## What is on this branch

- `docs/business_rules.md`: the day-use and exclusive-event addendum (BR-083 to BR-093).
- `backend/src/migrations/20261110_add_day_use_and_event_bookings.sql`: schema and
  routines for day-use and event bookings. New routine parameters have defaults, so
  the existing reservation code keeps working against a database that has it applied.

## What remains (December)

1. Rebase this branch onto the latest `main`. `main` has since changed `AGENTS.md`,
   the payment routines, and the docs, so expect conflicts there.
2. Rename the migration to a date after the newest migration on `main` (currently
   `20261114_*`) so it runs after them on fresh databases and the order is the same
   everywhere.
3. Wire the backend: reservation, kubo type, and upgrade routes, with Zod validation,
   role checks (BR-005), and audit rows (BR-067).
4. Build the frontend screens.
5. Add Postman write tests and update `docs/development-progress.md`, the README,
   `AGENTS.md`, and the module `API_CONTRACT.md` files.

## Note for local databases

At least one developer's local database already has the day-use migration applied.
Its routines have defaulted parameters, so `main` still works against it.
