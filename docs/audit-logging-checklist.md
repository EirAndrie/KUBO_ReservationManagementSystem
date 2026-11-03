# Audit Logging — Implementation Checklist

Phased plan for wiring audit writes into the remaining modules and hardening the
audit read API, per `docs/business_rules.md` BR-067 through BR-071 and BR-078.

Actor is always `req.auth.employeeId`; audit writes live inside PostgreSQL
mutation routines (BR-071), except login/logout which use an application helper.

## Decisions

- Implement phase-by-phase; revisit after each phase.
- Include guest mutations (create/update/delete).
- Redact/mask `guest.id_number` in audit snapshots (recommended).
- Add an audit-only `POST /auth/logout` endpoint.
- Commit the existing audit read API and the two audit migrations first.

## Phase 0 — Finalize and commit the audit read API ✅

- [x] Commit existing audit read API (`backend/src/modules/audit-logs/**`)
- [x] Commit audit migrations `20261031_add_audit_management_sql.sql` and
      `20261031_add_audit_history_query.sql`
- [x] Correct `AuditLogResponseDTO` to the snake_case DB shape
- [x] Define capitalized `AuditActionSchema` (`Create`, `Update`, `Delete`,
      `Login`, `Logout`, `Cancel`, `Approve`, `Reject`)
- [x] Add Zod `AuditLogFilterSchema` (employee, action, entityType, entityId,
      date range) and validate in the controller
- [x] Remove `CreateAuditLogSchema` / `UpdateAuditLogSchema` (append-only, BR-069)
- [x] Use `mapDatabaseError` in `getAuditLogById` / `searchAuditLogs`
- [x] Remove TODO comments and unused imports
- [x] Add `count` to list responses
- [x] Verify: `npm run typecheck` and `npm run build` pass

## Phase 1 — Reservation and assignments ✅

- [x] Thread actor through reservation controllers/services/repository
- [x] Thread actor through reserved-kubo controllers/services/repository
- [x] Migration `20261104_wire_reservation_audit.sql`
- [x] `fn_create_reservation` writes a `Create` audit row
- [x] `fn_update_reservation` writes an `Update` audit row
- [x] `fn_confirm_reservation` writes an `Update` audit row
- [x] `fn_cancel_reservation` writes a `Cancel` audit row
- [x] `fn_mark_no_show` writes an `Update` audit row
- [x] `fn_delete_reservation` writes a `Delete` audit row (before delete)
- [x] `fn_add_reserved_kubo` / `fn_update_reserved_kubo` / `fn_delete_reserved_kubo`
      write `Create` / `Update` / `Delete` rows (entity `reservation`)
- [x] `fn_approve_early_check_in` writes an `Update` audit row
- [x] `fn_check_in_reserved_kubo` / `fn_check_out_reserved_kubo` write `Update`
      rows
- [x] Verify: manual rollback test confirmed `fn_update_reservation` writes an
      `Update` row (entity `reservation`) and rolls back atomically

## Phase 2 — Role and employee

- [ ] Thread actor through role controllers/services/repository
- [ ] Thread actor through employee controllers/services/repository
- [ ] Migration `20261104_wire_identity_audit.sql`
- [ ] `create_role` / `update_role` / `delete_unused_role` audit `role`
- [ ] `create_employee` audits `employee` (no `password_hash` in values)
- [ ] `update_employee_role_status` audits `employee` (old/new safe fields)
- [ ] `reset_employee_password` audits `employee` (no `password_hash`)
- [ ] `delete_unused_employee` audits `employee` (before delete)
- [ ] Verify: no credentials in any audit row

## Phase 3 — Guest, kubo type, and kubo

- [ ] Thread actor through guest controllers/services/repository
- [ ] Thread actor through kubo-type controllers/services/repository
- [ ] Thread actor through kubo controllers/services/repository
- [ ] Migration `20261104_wire_guest_kubo_audit.sql`
- [ ] `fn_create_guest` / `fn_update_guest` / `fn_delete_unused_guest` audit
      `guest` (mask `id_number`)
- [ ] `fn_create_kubo_type` / `fn_update_kubo_type` /
      `fn_delete_unused_kubo_type` audit `kubo_type` (include `price_per_night`)
- [ ] `fn_create_kubo` / `fn_update_kubo` / `fn_change_kubo_status` /
      `fn_delete_unused_kubo` audit `kubo`
- [ ] Verify: rate changes and status changes produce audit rows

## Phase 4 — Login and logout

- [ ] Add `writeAuditLog` helper to the audit repository
- [ ] Successful login writes a `Login` audit row (`entity_type = employee`)
- [ ] Add `POST /auth/logout` (authenticated, audit-only, returns `204`)
- [ ] Logout writes a `Logout` audit row
- [ ] Verify: login/logout rows have correct actor and action

## Phase 5 — Documentation and verification

- [ ] Update `docs/development-progress.md` audit rows and "Next up"
- [ ] Update `docs/architecture.md` audit section
- [ ] Update `docs/validation.md` audit query validation
- [ ] Optionally update `docs/database.md` audit routine vocabulary
- [ ] Optionally refresh `AGENTS.md` (stale auth/RBAC/audit statements)
- [ ] `npm run typecheck` and `npm run build`
- [ ] Manual API/SQL regression matrix
