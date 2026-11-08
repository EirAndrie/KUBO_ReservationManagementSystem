# Development Progress

Ordered by database dependencies so each entity can be built on top of the
previous one.

**Last updated:** 2026-11-08

| Order | Entity | Status | Notes |
|---:|---|---|---|
| 1 | `role` | Complete | CRUD, validation, reference-safe deletion, and audit writes are in place. |
| 2 | `employee` | In progress | CRUD, safe reads, filtering/search, password reset, and last-Administrator checks are in place. Administrator-only RBAC is enforced and mutations write audit rows without exposing `password_hash`. |
| 3 | `guest` | In progress | CRUD, reuse-by-email/ID, full profile updates, DB pagination, and unused-guest deletion are in place. Deletion is now Administrator-only and writes are Staff-only. Audit writes are in place (`id_number` masked). |
| 4 | `kubo_type` | In progress | CRUD, paginated search/filtering, case-insensitive names, rate updates, and reference-safe deletion are in place. Writes are Administrator-only. Audit writes are in place (rate changes included). |
| 5 | `kubo` | In progress | CRUD, paginated search, type changes, status transitions, availability filtering, and reference-safe deletion are in place and mounted at `/kubos`. Writes are Administrator-only. Audit writes are in place. |
| 6 | `reservation` | In progress | Atomic create/update, generated reference codes, nested assignments, derived totals, confirm/cancel/no-show, check-in, and zero-balance checkout guard are in place. Unused reservation deletion removes assignment rows before the reservation and releases its kubos. Lifecycle operations are Staff-only, reservation creation records the authenticated employee, and all lifecycle mutations write audit rows. |
| 7 | `reserved_kubo` | In progress | Add/update/remove assignments and per-assignment check-in/check-out are wired under `/reservations/:id/kubos`. Assignment writes are Staff-only and audited under the parent reservation. |
| 8 | `additional_charge` | In progress | Catalog application, pre-settlement deletion, Administrator increase corrections, and charge-specific reductions via Adjustment/Reversal payments are implemented with audit writes and role enforcement. |
| 9 | `additional_charge_catalog` | In progress | Admin CRUD, activation/deactivation, usage totals, reference-safe deletion, and audit writes are implemented. Writes are Administrator-only. |
| 10 | `additional_charge_request` | In progress | Staff submission/withdrawal and Admin approval/rejection/adjustment are implemented with audit writes and role enforcement. |
| 11 | `payment` | In progress | Pending creation, allowed status transitions, refunds, charge-specific Adjustments and linked Reversals, filters, and Administrator-only cleanup deletion are implemented with role enforcement. Payment corrections include a reason and explicit links; cash net paid is derived separately from non-cash charge reductions. |
| 12 | `audit_log` | Complete | Append-only table, write/read routines, entity-history query, and a validated Administrator-only read API exist. All BR-067 events are audited: every tracked mutation plus successful login and logout. |

## Status legend

- **Complete** — usable end to end against the database.
- **In progress** — core flow works, but validation or business rules remain.
- **Scaffolded** — routes, controllers, services, repository, and schemas exist,
  but the database functions or integration are incomplete.
- **Not started** — no module implementation yet.

## Cross-cutting work

| Area | Status | Notes |
|---|---|---|
| Authentication | Complete | JWT bearer authentication: `POST /auth/login`, `GET /auth/me`, HS256 with an 8-hour default lifetime. `JWT_SECRET` is validated at startup and `JWT_EXPIRES_IN` defaults to `8h`. There is no refresh token or revocation. |
| RBAC | Complete | Global `authenticate` middleware plus per-route `authorizeRoles(...)`. The employee and role are re-read from the database on every request, so status and role changes apply immediately. Role matching is case-insensitive (`ADMIN`/`Administrator`, `STAFF`/`Staff`). |
| Audit writes | Complete | All BR-067 events are audited: tracked mutations plus successful login and logout. |

## Next up

1. Implement the planned frontend login flow and token handling.
2. Package migrations with the production build (`dist/migrations`) and bootstrap the additional-charge management schema safely.

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
- Refund-to-original linkage remains in the audit description. Charge Reversals have a
  `related_payment_id`, charge Adjustments and their Reversals have a
  `related_charge_id`, and both correction types store a required description.
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
- `POST /auth/logout` records an audit-only `Logout` event and returns `204`. JWTs are
  stateless and are not revoked, so the token remains valid until its expiry.
- RBAC is enforced at the route level. Reads require an authenticated employee;
  administrative and operational writes are separated according to the permission
  matrix. The seeded role names are `ADMIN` and `STAFF`, and matching is
  case-insensitive.
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
