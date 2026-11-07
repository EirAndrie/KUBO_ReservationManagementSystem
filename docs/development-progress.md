# Development Progress

Ordered by database dependencies so each entity can be built on top of the
previous one.

**Last updated:** 2026-11-07

| Order | Entity | Status | Notes |
|---:|---|---|---|
| 1 | `role` | Complete | CRUD, validation, reference-safe deletion, and audit writes are in place. Role names are the canonical lowercase values `administrator` and `staff`, enforced by a database `CHECK` constraint. |
| 2 | `employee` | In progress | CRUD, safe reads, filtering/search, password reset, and last-Administrator checks are in place. Administrator-only RBAC is enforced and mutations write audit rows without exposing `password_hash`. |
| 3 | `guest` | In progress | CRUD, reuse-by-email/ID, full profile updates, DB pagination, and unused-guest deletion are in place. Deletion is now Administrator-only and writes are Staff-only. Audit writes are in place (`id_number` masked). |
| 4 | `kubo_type` | In progress | CRUD, paginated search/filtering, case-insensitive names, rate updates, and reference-safe deletion are in place. Writes are Administrator-only. Audit writes are in place (rate changes included). |
| 5 | `kubo` | In progress | CRUD, paginated search, type changes, status transitions, availability filtering, and reference-safe deletion are in place and mounted at `/kubos`. Writes are Administrator-only. Audit writes are in place. |
| 6 | `reservation` | In progress | Atomic create/update, generated reference codes, nested assignments, derived totals, confirm/cancel/no-show, check-in, and zero-balance checkout guard are in place. Charge application and payment settlement are available, so checkout can reach zero. Lifecycle operations are Staff-only, reservation creation records the authenticated employee, and all lifecycle mutations write audit rows. |
| 7 | `reserved_kubo` | In progress | Add/update/remove assignments and per-assignment check-in/check-out are wired under `/reservations/:id/kubos`. Assignment writes are Staff-only and audited under the parent reservation. |
| 8 | `additional_charge` | In progress | Catalog application, pre-settlement deletion, and Administrator increase corrections are implemented with audit writes and role enforcement. Reduction via Adjustment/Reversal remains pending G-07. |
| 9 | `additional_charge_catalog` | In progress | Admin CRUD, activation/deactivation, usage totals, reference-safe deletion, and audit writes are implemented. Writes are Administrator-only. |
| 10 | `additional_charge_request` | In progress | Staff submission/withdrawal and Admin approval/rejection/adjustment are implemented with audit writes and role enforcement. |
| 11 | `payment` | In progress | Pending creation, allowed status transitions, refunds with net-paid limits, filters, and Administrator-only cleanup deletion are implemented with role enforcement. Cumulative refunds are linked through audit descriptions. Adjustment/Reversal balance effects remain. |
| 12 | `audit_log` | Complete | Append-only table, write/read routines, entity-history query, and a validated Administrator-only read API exist. All BR-067 events are audited: every tracked mutation plus successful login and logout. |

## Frontend

| Area | Status | Notes |
|---|---|---|
| Frontend app | Deployed | React 19 + Vite + TanStack Query app. Implemented: authentication, role-based dashboards, guests, reservations, kubos, kubo types, employees/roles, payments, audit logs, and the additional-charge catalog. Deployed on Vercel with `VITE_API_BASE_URL` pointing at the Render API. A dedicated custom additional-charge request review screen is not implemented. |

## Status legend

- **Deployed** — implemented and running in production, with remaining scoped work noted.
- **Complete** — usable end to end against the database.
- **In progress** — core flow works, but validation or business rules remain.
- **Scaffolded** — routes, controllers, services, repository, and schemas exist,
  but the database functions or integration are incomplete.
- **Not started** — no module implementation yet.

## Cross-cutting work

| Area | Status | Notes |
|---|---|---|
| Authentication | Complete | JWT bearer authentication: `POST /auth/login`, `GET /auth/me`, HS256 with an 8-hour default lifetime. `JWT_SECRET` is validated at startup and `JWT_EXPIRES_IN` defaults to `8h`. There is no refresh token or revocation. |
| RBAC | Complete | Global `authenticate` middleware plus per-route `authorizeRoles(...)`. The employee and role are re-read from the database on every request, so status and role changes apply immediately. Role names are canonical lowercase values (`administrator`, `staff`) matched exactly. |
| Audit writes | Complete | All BR-067 events are audited: tracked mutations plus successful login and logout. |
| CI | Complete | Separate backend and frontend workflows. Backend runs typecheck and build; frontend runs typecheck, lint, and build. |
| Deployment | Deployed | Backend on Render, frontend on Vercel. See [Deployment](#deployment). |
| Seed data | Complete | `npm run db:seed` inserts demo administrator/staff accounts, kubo types, kubos, and catalog items. The script is additive and idempotent. |
| Health and keep-alive | In progress | Public `GET <API_BASE_PATH>/health` performs a `SELECT 1`, and a GitHub Actions workflow pings it every 5 minutes. Database-failure handling still returns a generic `500` and needs a `503` JSON response. |

## Deployment

- **Backend:** Render web service. Because `npm run build` does not copy
  `src/migrations`, the Render build command currently installs dev dependencies
  and copies migrations explicitly:
  `npm ci --include=dev && npm run build && cp -r src/migrations dist/migrations`.
- **Backend environment:** `NODE_ENV=production`, `PORT` (provided by Render),
  `API_BASE_PATH=/KUBO_Resort/Management-System/v0.0.1`, `SERVE_FRONTEND=false`,
  `FR_ORIGIN=https://kubo-reservation-management-system.vercel.app`,
  `JWT_SECRET` (32+ characters), and the `DB_HOST` / `DB_PORT` / `DB_USERNAME` /
  `DB_PASSWORD` / `DB_NAME` values.
- **Frontend:** Vercel. `VITE_API_BASE_URL` must point at the Render backend plus
  `API_BASE_PATH`.
- **Production mode:** the frontend is hosted separately, so the backend runs
  API-only with `SERVE_FRONTEND=false`. Setting `SERVE_FRONTEND=true` restores
  serving `frontend/dist` and the SPA fallback.
- **Keep-alive:** `.github/workflows/keep-alive.yml` runs every 5 minutes and calls
  the health endpoint. `BACKEND_HEALTH_URL` must be configured in GitHub Actions;
  the workflow currently reads it from `secrets`.

## Next up

1. Resolve G-07 and implement Administrator reductions through Adjustment/Reversal payments.
2. Move the production migration copy into the repo (`postbuild`) and add
   `@types/node` explicitly so Render does not need a custom build workaround.
3. Harden the health endpoint: catch database errors and return `503` JSON instead
   of a generic `500` page.
4. Add automated tests; there is currently no unit or integration test suite.
5. Close the remaining application-only invariants (overlapping stays,
   at-least-one-kubo, complete status-transition coverage, derived totals).
6. Add the custom additional-charge request review screen to the frontend if the
   scope requires it.

## Recent changes (2026-11-04 to 2026-11-07)

- Enforced canonical lowercase role names (`administrator`, `staff`) across the
  database, backend, and frontend. The migration normalizes existing rows, adds a
  `CHECK` constraint, and tightens role create/update and administrator detection.
- Added `npm run db:seed` for demo accounts, kubo types, kubos, and catalog items.
- Made the API mount prefix configurable with `API_BASE_PATH`.
- Added production SPA serving from `frontend/dist` and a `SERVE_FRONTEND` switch;
  the Render backend runs API-only because the frontend is hosted on Vercel.
- Added a public health endpoint that performs a database query and a GitHub Actions
  keep-alive workflow that runs every 5 minutes.
- Split CI into separate backend and frontend workflows and added a backend `start`
  script for deployment.
- Implemented and deployed the React/Vite frontend on Vercel.

## Notes

- Migrations now cover role, employee, guest, kubo type, kubo, reservation,
  reserved kubo, additional charges/catalog/requests, payment, audit
  infrastructure, and authentication routines (`kubo_auth_management`).
- The reservation stack is mounted at `/reservations`; assignment routes are
  nested at `/reservations/:reservationId/kubos`. Payments are mounted at
  `/reservations/:reservationId/payments` and `/payments`. Additional-charge routes
  are root-mounted under their own full paths.
- Check-out is intentionally blocked until the outstanding balance is zero.
  Completed payments reduce the balance, and refunds restore it.
- Payment creation is Staff-only and starts as `Pending`; completion is a separate
  status transition. Refunds require a completed original payment and cannot exceed
  the reservation's net paid amount.
- `fn_get_reservation_balance` counts `Payment` rows in `Completed`,
  `PartiallyRefunded`, or `Refunded` as received, with completed `Refund` rows
  offsetting them. This correction is required because BR-054 changes the original
  payment status after a refund.
- Refund-to-original linkage is stored in the audit description because the schema has
  no `original_payment_id` column.
- The cleanup-only payment delete route is Administrator-only and exists for
  development/repair use. Normal corrections must use refunds.
- Payment, additional-charge, and reservation-creation mutations take the acting
  employee from the access token (`req.auth.employeeId`); a client-supplied
  `employeeId` is ignored. The reservation actor migration is committed on `main`
  (`e418993`, PR #36).
- Authentication uses JWT bearer tokens issued by `POST /auth/login`; `GET /auth/me`
  returns the current profile. The token identifies the employee only, and the role and
  status are re-read from the database on every request.
- `POST /auth/logout` records an audit-only `Logout` event and returns `204`. JWTs are
  stateless and are not revoked, so the token remains valid until its expiry.
- RBAC is enforced at the route level. Reads require an authenticated employee;
  administrative and operational writes are separated according to the permission
  matrix. Role names are stored and matched as the canonical lowercase values
  `administrator` and `staff`.
- `JWT_SECRET` must be set or the server refuses to start; production requires at least
  32 characters. `JWT_EXPIRES_IN` defaults to `8h`.
- The additional-charge design uses an Admin-managed catalog, Staff catalog
  application, and approval-gated custom “Other” requests. Applied charges are mounted
  at `/reservations/:reservationId/charges`; catalog and request review endpoints are
  also available. Used catalog items must be deactivated rather than deleted, and
  applied-charge deletion is blocked after settlement. See
  `docs/additional-charge-hybrid-change-tracker.md`.
- Administrator increase corrections are implemented. Reductions remain pending until
  Adjustment/Reversal payment support is implemented (G-07).
- Audit writes are implemented for all tracked mutations plus successful login and
  logout. The audit read API includes general search, single-log reads, employee-scoped
  logs, and entity-history reads.
- Authentication, route-level RBAC, the actor refactors, the audit migrations, and the
  audit read/write wiring are committed on `main`.
- The additional-charge migration expects the pre-existing
  `kubo_additional_charges_management` schema and skips its routines if that schema is
  absent. The payment migration creates `kubo_payment_management` itself.
- The authentication migration (`20261103_add_auth_management.sql`) creates
  `kubo_auth_management.get_login_credentials` and `get_authenticated_employee`. The base
  `employee` table and `role_status` enum remain pre-existing schema and are not created
  by the migrations in this repository.
- Role and employee management, audit-log reads, and configuration writes are
  Administrator-only. Guest and reservation writes, assignments, check-in/out, payments,
  and charge operations are Staff-only. All reads require an authenticated employee.
