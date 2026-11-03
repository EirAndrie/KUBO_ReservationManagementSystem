# Kubo Reservation System - Agent Instructions

## Start Here

- `backend/` is the only runnable app. `frontend/` contains planning documents only; there is no frontend `package.json` or source code yet.
- Run all commands from `backend/`.
- `docs/business_rules.md` is the authoritative domain specification. The `business_rules_DDL.md` and `business_rules_review.md` files it references do not exist in this repo.
- Read the relevant doc before changing an area in `docs/`: `architecture.md`, `database.md`, `api.md`, `validation.md`, `coding-standards.md`, `system_flowcharts.md`.
- For planned frontend work, read `frontend/frontend-agents.md` and its companion files. Those files describe a Vite/React app that has not been implemented.

## Commands

```bash
cd backend
npm ci              # CI uses this; npm install also works
npm run dev         # nodemon -> ts-node src/server.ts
npm run typecheck   # tsc --noEmit; required by CI
npm run build       # tsc -> dist/
```

- CI (`.github/workflows/ci.yml`) runs `npm ci`, then `npm run typecheck`, then `npm run build` on pushes/PRs to `main`.
- There is no test, lint, or formatter configuration. Do not claim a test suite exists.
- Do **not** run `npm run db:generate` or `npm run db:migrate`. Those scripts call `drizzle-kit`, which is not installed and is inconsistent with the no-ORM rule.
- `npm run build` does not copy `src/migrations/*.sql` into `dist/`. `node dist/server.js` will fail at migration startup unless migrations are copied to `dist/migrations`.

## Setup and Environment

- CI uses Node 22; README recommends PostgreSQL 15+.
- Create `backend/.env`. `dotenv` loads relative to the working directory, so start the server from `backend/`.
- The PostgreSQL pool actually reads: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`.
- `DB_URL` and `PASSWORD_LENGTH` are declared in `src/config/env.ts` but unused. Do not assume `DB_URL` configures the connection.
- Startup requires a live database. It connects, then runs every `src/migrations/*.sql` in filename order, tracking applied files in `schema_migrations`. Migrations now cover role, employee, guest, kubo type, kubo, reservation, reserved kubo, additional charges/catalog/requests, payments, and audit infrastructure. The additional-charge migration expects the pre-existing `kubo_additional_charges_management` schema; the payment migration creates `kubo_payment_management`.
- `src/utils/logger.ts` creates `logs/` relative to the working directory.

## Backend Layout

The real module layout is flatter than `docs/architecture.md` describes:

```text
backend/src/modules/<feature>/
├── <feature>.routes.ts
├── <feature>.controllers.ts
├── <feature>.services.ts
└── repository/
    ├── <feature>.repository.ts
    └── <feature>.schema.ts
```

- File suffixes are plural (`*.controllers.ts`, `*.services.ts`), despite the singular names in `docs/api.md` and `docs/coding-standards.md`.
- Schemas live directly in `repository/<feature>.schema.ts`. The documented `repository/{schemas,procedures,validations,queries}` folders do not exist. Match the existing module unless the task explicitly migrates it.
- Keep the dependency direction strict: routes -> controllers -> services -> repositories -> PostgreSQL. Do not create global `src/controllers`, `src/services`, or `src/repositories` folders.
- Import the shared pool as `db` from `src/config/connectDB.ts`. `docs/database.md` points to `src/database/pool.ts`, which does not exist.
- SQL belongs only in repositories. Always use parameterized queries, typically against `kubo.*` stored functions.
- Routes apply `validateBody(...)` and `requireUuidParam(...)` from `src/utils/http.ts`; controllers call `getPagination(req.query)` and `handleControllerError(...)`.
- Error handling is per-controller: `throw new AppError(status, message)`, catch in the controller, then call `handleControllerError`. There is no global Express error middleware.
- Response envelopes are inconsistent between modules (`data`, `guests`, `auditLogs`, or a raw array). Match the module you are editing; `docs/api.md` is not an exact contract.

## API Wiring

- `src/modules/index.ts` is the source of truth for mounted routes.
- The real base path is `/KUBO_Resort/Management-System/v0.0.1`, not `/api` as the docs and frontend plan state.
- Mounted prefixes: `/roles`, `/guests`, `/kubo-types`, `/kubos`, `/employees`, `/reservations`, `/audit-logs`, plus root-mounted route groups for payments and additional charges.
- Reservation assignment routes are under `/reservations/:reservationId/kubos`. Payments are under `/reservations/:reservationId/payments` and `/payments`. Additional-charge routes define their own full paths under `/additional-charge-catalog`, `/additional-charges`, `/additional-charge-requests`, and `/reservations/:reservationId/charges`.
- Authentication (`authenticate`) and role-based access (`authorizeRoles`) are implemented and mounted in `src/modules/index.ts`. The acting employee is always `req.auth.employeeId`; clients cannot supply an `employeeId` to act on another employee's behalf.

## Data and Validation Rules

- PostgreSQL through `pg` only. No ORM, no Drizzle ORM.
- `drizzle-zod` is mentioned in the docs but is not installed. Use plain `zod` (v4).
- Validate external input with Zod before business logic: bodies at the route, query/path values in the controller or `requireUuidParam`.
- Treat PostgreSQL as the constraint authority, but remember some business invariants are application-only. `docs/business_rules.md` documents the gaps (overlapping stays, at-least-one-kubo, status transitions, derived totals).
- `reservationTotalAmount` in the backend reservation schema is stale per BR-040/G-06. Reservation totals, charges, net paid, and balances must be derived, not stored.
- Prefer PostgreSQL functions/procedures for multi-table or atomic operations. Most current repositories call stored functions shipped in `src/migrations`; treat the migration files as the source of truth.

## Current Progress Context (2026-11-03)

This section records the implementation state so a new agent does not have to
rediscover it. It is context, not a replacement for `docs/business_rules.md`.

### Repository state

- `main` includes the merged additional-charge/payment hardening work
  (`63d4be0`, merge `2193c67`).
- Authentication, RBAC, and audit logging (read API plus writes across all modules,
  including login/logout) are committed on `main`.
- Remaining uncommitted working-tree work is limited to documentation and frontend
  planning updates under `docs/` and `frontend/docs/`.
- `backend/` is the only runnable app. `frontend/` remains planning-only.

### Backend module state

| Area | Current state |
|---|---|
| `role` | CRUD, validation, and reference-safe deletion. |
| `employee` | CRUD, safe reads, filtering/search, password reset, last-Administrator checks, Administrator-only RBAC, and audit writes (no `password_hash`). |
| `guest` | CRUD, reuse-by-email/ID, profile updates, DB pagination, unused-guest deletion, Administrator-only deletion, and audit writes (`id_number` masked). |
| `kubo_type` | CRUD, paginated search/filtering, case-insensitive names, rate updates, and reference-safe deletion. |
| `kubo` | CRUD, paginated search, type changes, status transitions, availability filtering, and reference-safe deletion. Mounted at `/kubos`. |
| `reservation` | Atomic create/update, generated reference codes, nested assignments, derived totals, confirm/cancel/no-show, check-in, zero-balance checkout guard, Staff-only lifecycle, and audit writes. |
| `reserved_kubo` | Add/update/remove assignments and per-assignment check-in/check-out under `/reservations/:reservationId/kubos`. |
| `additional_charge` | Catalog application, pre-settlement deletion, and Administrator increase corrections. Reductions are deferred. |
| `additional_charge_catalog` | Administrator CRUD, activation/deactivation, usage totals, and reference-safe deletion. |
| `additional_charge_request` | Staff submission/withdrawal and Administrator approval/rejection/adjustment. |
| `payment` | Pending creation, status transitions, refunds, filters, and Administrator cleanup deletion. Adjustment/Reversal effects remain deferred. |
| `audit_log` | Append-only table, write routine, read routines, entity-history query, and Administrator-only read API. All tracked mutations plus successful login/logout write audit rows. |

### Additional-charge implementation

The approved hybrid model is implemented in
`20261102_harden_additional_charge_management.sql`:

- New enum: `kubo.charge_request_status`
  (`Pending`, `Approved`, `Rejected`, `Withdrawn`).
- New tables: `kubo.additional_charge_catalog` and
  `kubo.additional_charge_request`.
- `kubo.additional_charge` gained `catalog_id`, `request_id`, `quantity`, and
  `unit_amount`; existing rows were backfilled with quantity `1` and
  `unit_amount = amount`.
- Constraints enforce positive quantity, non-negative unit amount, and
  `amount = round(quantity * unit_amount, 2)`.
- `20261102_add_reservation_charge_request_delete_guard.sql` adds a trigger that
  blocks repair deletion of a reservation with custom charge-request history.

Behavior:

- Administrators manage catalog items. Names are case-insensitively unique; used
  items cannot be deleted and must be deactivated.
- Staff apply active catalog items to `Pending`, `Confirmed`, `CheckedIn`, or
  `CheckedOut` reservations. Applied charges snapshot quantity, unit price, total,
  and catalog name/description; later catalog changes do not alter them.
- Custom `Other` requests start as `Pending` and do not affect the balance. Only the
  requesting Staff member can withdraw while pending.
- Administrators approve or reject requests. Approval can adjust the approved unit
  amount, but an adjustment reason is required. Approval creates the applied charge.
- Applied-charge deletion is Staff-only and blocked after settlement. Settlement means
  a terminal reservation status (`CheckedOut`, `Cancelled`, `NoShow`) or any completed
  payment/refund.
- Administrator corrections are increases only: a new applied charge is inserted and
  the original is never edited or deleted. Reductions wait on Adjustment/Reversal
  payment semantics (gap G-07).
- Pending, rejected, and withdrawn requests are excluded from balance totals.
- All additional-charge mutations write audit rows through
  `kubo_audit_management.write_audit_log`.

### Payment implementation

The payment lifecycle is implemented in
`20261102_harden_payment_management.sql` against the existing `kubo.payment` table:

- Staff create payments with server-controlled `Pending` status and timestamp.
- Payments are limited to `Pending`, `Confirmed`, `CheckedIn`, or `CheckedOut`
  reservations and cannot exceed the outstanding balance.
- Allowed transitions: `Pending` -> `Processing`/`Completed`/`Failed`/`Cancelled`;
  `Processing` -> `Completed`/`Failed`/`Cancelled`.
- `Completed` -> `Refunded`/`PartiallyRefunded` is not a manual transition. The refund
  routine performs it.
- Refunds are Staff-only, require a completed original payment of the same
  reservation, use a positive `Refund` amount, and cannot exceed net paid.
- Cumulative refunds are linked to the original through the refund audit description
  because the schema has no `original_payment_id` column. The original becomes
  `PartiallyRefunded` or `Refunded` based on the cumulative amount.
- Reads support filters by reservation, processor, status, method, transaction type,
  and date range, with pagination.
- `20261102_fix_reservation_balance_refund_status.sql` corrected
  `fn_get_reservation_balance`: `Payment` rows in `Completed`, `PartiallyRefunded`,
  or `Refunded` count as received; completed `Refund` rows offset them. Without this,
  refunds produced incorrect or negative net-paid values.
- Cleanup deletion is Administrator-only, audited, and intended for
  development/repair. Normal corrections must use refunds.
- All payment mutations write audit rows.

### Audit implementation

- `kubo_audit_management.write_audit_log` is the shared write routine.
- `kubo.audit_log` is append-only through
  `kubo_audit_management.prevent_audit_mutation`.
- `kubo.get_audit_history(entity_type, entity_id, limit, offset)` supports entity
  history, newest first.
- Audit read routes are in `src/modules/audit-logs`:
  `GET /audit-logs`, `GET /audit-logs/:auditId`,
  `GET /audit-logs/history/:entityType/:entityId`, and
  `GET /audit-logs/employees/:employeeId/audit-logs`.
- Refund audit rows include the original payment ID in the description.
- Audit writes use the authenticated `req.auth.employeeId`; a client-supplied `employeeId` is ignored.

### Migration inventory

- Foundation and hardening:
  `20240920_create_role_schema.sql`,
  `20261031_add_audit_management_sql.sql`,
  `20261031_add_audit_history_query.sql`,
  `20261031_extend_get_employees_filters.sql`,
  `20261031_fix_update_employee_profile.sql`,
  `20261031_harden_guest_management.sql`,
  `20261031_harden_role_employee_management.sql`,
  `20261101_harden_kubo_management.sql`,
  `20261101_harden_kubo_type_management.sql`,
  `20261101_harden_reservation_management.sql`.
- Additional charges and payments:
  `20261102_harden_additional_charge_management.sql`,
  `20261102_add_reservation_charge_request_delete_guard.sql`,
  `20261102_harden_payment_management.sql`,
  `20261102_fix_reservation_balance_refund_status.sql`.

### Route and response conventions

- Base path: `/KUBO_Resort/Management-System/v0.0.1`.
- Payment response key: `payments`.
- Additional-charge response keys: `additionalChargeCatalog`,
  `additionalCharges`, and `additionalChargeRequests`.
- List endpoints generally include `count`.
- `mapDatabaseError` maps `23505` -> `400`, `23503` -> `409`, `23514` -> `400`,
  `22023` -> `400`, `P0002` -> `404`, and `42501` -> `403` (the `42501` case is
  currently uncommitted).

### Local verification data

These IDs existed during the latest manual verification and may change:

- Administrator: `5efe3900-8a3c-4053-87f8-f6588257c7d5` (Maria Santos).
- Staff: `b52b52f5-14a4-442e-b836-81f8f0e8c476` (Metch Amores).
- Reservation: `5be2d27d-a10e-440a-acab-95b8020bfecf`
  (`RES-20261101-7594`, `CheckedIn`, outstanding balance `26800.00` after test
  cleanup).
- Kubo assignments on that reservation included
  `080664b5-05ca-43af-81dc-734c1f03a674` and
  `c4f6fff3-94fa-4820-88c8-d7d751ffc0dc` (`CheckedIn`).

Manual verification performed: `npm run typecheck`, `npm run build`, catalog
lifecycle, catalog application, custom request approval/rejection/withdrawal,
pre-settlement charge deletion, payment create/complete/refund flows, overpayment
and over-refund rejection, role checks, filters, cleanup deletion, and a rolled-back
zero-balance checkout transaction. There is no automated test suite.

### Known gaps and risks

- Authentication and RBAC middleware are not implemented.
- Adjustment/Reversal balance effects are unresolved (G-07); Administrator reductions
  are not implemented.
- Overpayment approval (BR-053) is not implemented; overpayment is blocked.
- Refund linkage relies on the audit description.
- Audit wiring is incomplete for reservation, role, employee, guest, kubo, and
  kubo-type mutations.
- The frontend has not been implemented.
- The Drawio ERD files do not include the catalog/request schema.
- `npm run build` does not copy `src/migrations/*.sql` into `dist/`; a production
  `node dist/server.js` run needs migrations available at `dist/migrations`.
- The additional-charge migration skips its routines if the pre-existing
  `kubo_additional_charges_management` schema is absent.
- Payment cleanup deletion bypasses the normal no-delete policy by design and must
  remain Administrator-only.

## Documentation Expectations

Add production-ready JSDoc (`/** */`) for major features, services, repositories, and non-obvious logic. Document purpose, business rules, parameters/returns, database side effects, transaction boundaries, security requirements, and failure behavior. Do not restate obvious code or leave stale comments.

## Workflow

1. Inspect the affected module and its existing patterns.
2. Read the relevant `docs/*.md` file and, for domain behavior, `docs/business_rules.md`.
3. Choose the correct layer; keep SQL out of controllers and services.
4. Reuse existing helpers (`http`, `pagination`, `logger`, shared `db`) instead of adding abstractions.
5. Make the smallest change; do not touch unrelated docs or code.
6. Run `npm run typecheck` (and `npm run build` when build output matters).
7. Verify route mounting and response shape for API changes.

## Rules and Priorities

- Do not invent database fields, relationships, endpoints, or business rules.
- Do not bypass services or repositories.
- Do not introduce an ORM, new database driver, or unnecessary dependency.
- Preserve existing behavior unless the task requires changing it.
- When instructions conflict, follow: explicit task requirements, then this file, then `docs/*.md`, then existing conventions.
