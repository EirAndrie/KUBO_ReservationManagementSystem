# Development Progress

Ordered by database dependencies so each entity can be built on top of the
previous one.

**Last updated:** 2026-11-14

| Order | Entity | Status | Notes |
|---:|---|---|---|
| 1 | `role` | Complete | CRUD, validation, reference-safe deletion, and audit writes are in place. Role names are the canonical lowercase values `administrator` and `staff`, enforced by a database `CHECK` constraint. |
| 2 | `employee` | In progress | CRUD, safe reads, filtering/search, password reset, and last-Administrator checks are in place. Administrator-only RBAC is enforced and mutations write audit rows without exposing `password_hash`. |
| 3 | `guest` | In progress | CRUD, reuse-by-email/ID, full profile updates, DB pagination, and unused-guest deletion are in place. Deletion is now Administrator-only and writes are Staff-only. Audit writes are in place (`id_number` masked). |
| 4 | `kubo_type` | In progress | CRUD, paginated search/filtering, case-insensitive names, rate updates, and reference-safe deletion are in place. Writes are Administrator-only. Audit writes are in place (rate changes included). |
| 5 | `kubo` | In progress | CRUD, paginated search, type changes, status transitions, availability filtering, and reference-safe deletion are in place and mounted at `/kubos`. Writes are Administrator-only. Audit writes are in place. |
| 6 | `reservation` | In progress | Atomic create/update, generated reference codes, nested assignments, derived totals, confirm/cancel/no-show, check-in, and zero-balance checkout guard are in place. Unused reservation deletion removes assignment rows before the reservation and releases its kubos. Lifecycle operations are Staff-only, reservation creation records the authenticated employee, and all lifecycle mutations write audit rows. |
| 7 | `reserved_kubo` | In progress | Add/update/remove assignments and per-assignment check-in/check-out are wired under `/reservations/:id/kubos`. Assignment writes are Staff-only and audited under the parent reservation. |
| 8 | `additional_charge` | In progress | Catalog application, pre-settlement deletion, Administrator increase corrections, and charge-specific reductions via Adjustment/Reversal payments are implemented with audit writes and role enforcement. |
| 9 | `additional_charge_catalog` | In progress | Admin CRUD, activation/deactivation, usage totals, reference-safe deletion, and audit writes are implemented. Writes are Administrator-only. |
| 10 | `additional_charge_request` | In progress | Staff submission/withdrawal and Admin approval/rejection/adjustment are implemented with audit writes and role enforcement. |
| 11 | `payment` | In progress | Pending creation, allowed status transitions, refunds, charge-specific Adjustments and linked Reversals, filters, and Administrator-only cleanup deletion are implemented with role enforcement. Payment corrections include a reason and explicit links; cash net paid is derived separately from non-cash charge reductions. Refunds now store `related_payment_id` (backfilled for older refunds) and cannot exceed the original payment. Overpayments are allowed only with an audited Administrator overpayment approval (BR-053). |
| 12 | `audit_log` | Complete | Append-only table, write/read routines, entity-history query, and a validated Administrator-only read API exist. All BR-067 events are audited: every tracked mutation plus successful login and logout. |

## Frontend

| Area | Status | Notes |
|---|---|---|
| Frontend app | Deployed | React 19 + Vite + TanStack Query app. Implemented: authentication, role-based dashboards, guests, reservations, kubos, kubo types, employees/roles, payments, audit logs, the additional-charge catalog, the Administrator charge-request review page (`/charge-requests`), and overpayment approvals on the reservation page. Deployed on Vercel with `VITE_API_BASE_URL` pointing at the Render API. |

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
| Authentication | Complete | JWT bearer authentication: `POST /auth/login`, `GET /auth/me`, HS256 with an 8-hour default lifetime. `JWT_SECRET` is validated at startup and `JWT_EXPIRES_IN` defaults to `8h`. Each token has a `jti`; `POST /auth/logout` revokes it (`kubo_auth_management.revoked_token`). There are no refresh tokens. |
| RBAC | Complete | Global `authenticate` middleware plus per-route `authorizeRoles(...)`. The employee and role are re-read from the database on every request, so status and role changes apply immediately. Role names are canonical lowercase values (`administrator`, `staff`) matched exactly. |
| Audit writes | Complete | All BR-067 events are audited: tracked mutations plus successful login and logout. |
| CI | Complete | Separate backend and frontend workflows. Backend runs typecheck and build; frontend runs typecheck, lint, and build. |
| Deployment | Deployed | Backend on Render, frontend on Vercel. See [Deployment](#deployment). |
| Seed data | Complete | `npm run db:seed` inserts demo administrator/staff accounts, kubo types, kubos, and catalog items. The script is additive and idempotent. |
| Health and keep-alive | Complete | Public `GET <API_BASE_PATH>/health` performs a `SELECT 1` with a 5-second limit and returns `200` (`database: "up"`) or `503` JSON (`database: "down"`). A GitHub Actions workflow pings it every 5 minutes. |

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

1. Run the Postman collection (read-only and write tests) and the Admin/Staff checklist (`docs/admin-staff-test-checklist.md`) against the deployed stack before submission.
2. Bootstrap the additional-charge management schema safely when it is absent (the migration currently skips its routines).

## Planned work

| Area | Target | Notes |
|---|---|---|
| Day-use and exclusive-event bookings (BR-083 to BR-093) | December 2026 | The team will resume and complete this feature in December. Kept off `main` until then. A business-rules addendum and a draft migration (`20261110_add_day_use_and_event_bookings.sql`) are on the `feat/day-use-bookings` branch on GitHub; its `docs/day-use-bookings-status.md` tracks the remaining steps. Remaining: rebase onto `main`, then wire the reservation, kubo type, and upgrade routes and the frontend. Do not add day-use code to `main` before then. |

## Notes

- Migrations now cover role, employee, guest, kubo type, kubo, reservation,
  reserved kubo, additional charges/catalog/requests, payment, audit
  infrastructure, and authentication routines (`kubo_auth_management`).
- The reservation stack is mounted at `/reservations`; assignment routes are
  nested at `/reservations/:reservationId/kubos`. Payments are mounted at
  `/reservations/:reservationId/payments` and `/payments`. Additional-charge routes
  are root-mounted under their own full paths.
- Check-out is intentionally blocked until the outstanding balance is zero.
  Completed payments and charge Adjustments reduce it; refunds and Reversals restore
  the corresponding balance. A negative balance represents a guest credit.
- Payment creation is Staff-only and starts as `Pending`; completion is a separate
  status transition. Refunds require a completed original payment and cannot exceed
  the reservation's net paid amount.
- `fn_get_reservation_balance` counts `Payment` rows in `Completed`,
  `PartiallyRefunded`, or `Refunded` as received, with completed `Refund` rows
  offsetting them. This correction is required because BR-054 changes the original
  payment status after a refund.
- Refunds and charge Reversals both use `related_payment_id` (a Refund points at its
  original Payment; `20261114_link_refunds_to_original_payment.sql` backfilled older
  refunds from their audit description). Charge Adjustments and their Reversals have a
  `related_charge_id`, and both correction types store a required description.
- BR-053 overpayments: an Administrator records an approval (maximum excess plus a
  reason) on `kubo.overpayment_approval`; Staff choose it when a payment exceeds the
  balance. The approval is consumed by that payment, re-checked on completion, released
  if the payment fails or is cancelled, and revocable while unused. The resulting credit
  must be refunded before check-out because the check-out guard requires a zero balance.
- The cleanup-only payment delete route is Administrator-only and exists for
  development/repair use. Cash returns use Refund rows; applied-charge reductions
  use audited Adjustment rows and can be offset by linked Reversal rows.
- Payment, additional-charge, and reservation-creation mutations take the acting
  employee from the access token (`req.auth.employeeId`); a client-supplied
  `employeeId` is ignored. The reservation actor migration is committed on `main`
  (`e418993`, PR #36).
- Authentication uses JWT bearer tokens issued by `POST /auth/login`; `GET /auth/me`
  returns the current profile. The token identifies the employee only, and the role and
  status are re-read from the database on every request.
- `POST /auth/logout` revokes the presented token by its `jti` until the token expires,
  records a `Logout` audit event, and returns `204`. Tokens without a `jti` (issued before
  this change) are refused.
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
- Administrator increase corrections and charge-specific Adjustment/Reversal
  corrections are implemented. G-07 is resolved; see BR-047, BR-057, and BR-081.
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
- Role and employee management, audit-log reads, configuration writes, charge
  Adjustments/Reversals, and request review are Administrator-only. Guest and
  reservation writes, assignments, check-in/out, routine payments/refunds, and charge
  operations are Staff-only. All reads require an authenticated employee.
