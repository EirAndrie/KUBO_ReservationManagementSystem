# Development Progress

Ordered by database dependencies so each entity can be built on top of the
previous one.

**Last updated:** 2026-11-03

| Order | Entity | Status | Notes |
|---:|---|---|---|
| 1 | `role` | Complete | CRUD, validation, reference-safe deletion, and audit writes are in place. |
| 2 | `employee` | In progress | CRUD, safe reads, filtering/search, password reset, and last-Administrator checks are in place. Administrator-only RBAC is enforced and mutations write audit rows without exposing `password_hash`. |
| 3 | `guest` | In progress | CRUD, reuse-by-email/ID, full profile updates, DB pagination, and unused-guest deletion are in place. Deletion is now Administrator-only and writes are Staff-only. Audit writes remain. |
| 4 | `kubo_type` | In progress | CRUD, paginated search/filtering, case-insensitive names, rate updates, and reference-safe deletion are in place. Writes are Administrator-only. Audit wiring remains. |
| 5 | `kubo` | In progress | CRUD, paginated search, type changes, status transitions, availability filtering, and reference-safe deletion are in place and mounted at `/kubos`. Writes are Administrator-only. Audit wiring remains. |
| 6 | `reservation` | In progress | Atomic create/update, generated reference codes, nested assignments, derived totals, confirm/cancel/no-show, check-in, and zero-balance checkout guard are in place. Charge application and payment settlement are available, so checkout can reach zero. Lifecycle operations are Staff-only, reservation creation records the authenticated employee, and all lifecycle mutations write audit rows. |
| 7 | `reserved_kubo` | In progress | Add/update/remove assignments and per-assignment check-in/check-out are wired under `/reservations/:id/kubos`. Assignment writes are Staff-only and audited under the parent reservation. |
| 8 | `additional_charge` | In progress | Catalog application, pre-settlement deletion, and Administrator increase corrections are implemented with audit writes and role enforcement. Reduction via Adjustment/Reversal remains pending G-07. |
| 9 | `additional_charge_catalog` | In progress | Admin CRUD, activation/deactivation, usage totals, reference-safe deletion, and audit writes are implemented. Writes are Administrator-only. |
| 10 | `additional_charge_request` | In progress | Staff submission/withdrawal and Admin approval/rejection/adjustment are implemented with audit writes and role enforcement. |
| 11 | `payment` | In progress | Pending creation, allowed status transitions, refunds with net-paid limits, filters, and Administrator-only cleanup deletion are implemented with role enforcement. Cumulative refunds are linked through audit descriptions. Adjustment/Reversal balance effects remain. |
| 12 | `audit_log` | In progress | Append-only table, write/read routines, entity-history query, and a validated Administrator-only read API exist. Additional-charge, payment, reservation, assignment, role, and employee mutations write audit rows; guest, kubo, and kubo-type mutations still need wiring. |

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
| Audit writes | Partial | Additional-charge, payment, reservation, assignment, role, and employee mutations write audit rows. Guest, kubo, and kubo-type mutations still need wiring. |
| Automated tests | Not configured | Verification is currently manual through TypeScript, database tests, and API calls. |

## Next up

1. Resolve G-07 and implement Administrator reductions through Adjustment/Reversal payments.
2. Wire audit writes into guest, kubo, and kubo-type mutations (reservation, role, and employee done).
3. Implement the planned frontend login flow and token handling.
4. Add automated regression coverage for the completed entities.
5. Package migrations with the production build (`dist/migrations`) and bootstrap the additional-charge management schema safely.

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
- Administrator increase corrections are implemented. Reductions remain pending until
  Adjustment/Reversal payment support is implemented (G-07).
- Audit writes are implemented for additional-charge and payment mutations. The audit
  read API includes general search, single-log reads, employee-scoped logs, and
  entity-history reads.
- The audit-history read API, the two audit migrations, and related documentation are
  still uncommitted in the working tree. The SQL `42501` to HTTP `403` mapping,
  authentication, route-level RBAC, the payment/additional-charge actor refactor, and
  the reservation-creation actor migration are committed on `main`.
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
