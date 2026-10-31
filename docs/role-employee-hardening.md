# Role and Employee Hardening Changes

**Date:** 2026-10-31

## Summary

This change hardens the role and employee database routines against the
business rules that were missing before proceeding to the Guest entity.

The main fixes are:

- Safe employee reads that never return `password_hash`.
- Employee create/update/delete routines that return usable results.
- A password-reset routine and API endpoint.
- Last-active-Administrator checks for create, update, deactivate, reassign and
  delete.
- Friendly duplicate-username and referenced-role errors.
- Role create/update validation and a reference-safe delete routine.
- Audit-log write/read SQL and append-only protection.
- Employee status input normalization.
- Hardened `SECURITY DEFINER` search paths.

## Migrations added

### `20261031_harden_role_employee_management.sql`

Adds or replaces:

| Routine | Change |
|---|---|
| `kubo_employee_management.get_employee_by_id` | Returns a safe employee table without `password_hash`. |
| `kubo_employee_management.create_employee` | Converted from procedure to function returning the safe employee row. Status defaults to `Active`. Enforces last-active-Administrator rules. Returns friendly duplicate-username errors. |
| `kubo_employee_management.update_employee_role_status` | Returns the safe employee row. Enforces last-active-Administrator rules. Handles duplicate usernames. |
| `kubo_employee_management.delete_unused_employee` | Converted from procedure to function returning `boolean`. Blocks deleting the last active Administrator. Keeps history-reference checks. |
| `kubo_employee_management.reset_employee_password` | New password-reset routine accepting a pre-hashed bcrypt value and returning the safe employee row. |
| `kubo_employee_management.is_administrator_role` | New helper that accepts `ADMIN`/`admin` and `Administrator`/`administrator`. |
| `kubo_employee_management.check_username_exists` | Added hardened search path. |
| `kubo_role_management.create_role` | Trims and validates the name/description; friendly duplicate-name error. |
| `kubo_role_management.update_role` | Trims and validates the name/description; friendly duplicate-name error. |
| `kubo_role_management.get_roles` | Added hardened search path. |
| `kubo_role_management.get_role_by_id` | Added hardened search path. |
| `kubo_role_management.get_role_by_name` | Added hardened search path and trimmed lookup. |
| `kubo_role_management.delete_unused_role` | Replaces `delete_role`. Returns `boolean` and rejects roles still assigned to employees. |

Also adds a case-insensitive unique index on `lower(role_name)`.

### `20261031_add_audit_management_sql.sql`

Adds:

| Routine / object | Purpose |
|---|---|
| `kubo_audit_management.write_audit_log` | Validates the acting employee and inserts an audit row. |
| `kubo.get_audit_log_by_id` | Read routine used by the audit-log module. |
| `kubo.search_audit_logs` | Filtered/paginated read routine used by the audit-log module. |
| `kubo.get_audit_history` | Returns the audit history for one entity (`entity_type` + `entity_id`), newest first. |
| `audit_log_append_only` trigger | Blocks `UPDATE` and `DELETE` on `kubo.audit_log`. |
| `audit_log_no_truncate` trigger | Blocks `TRUNCATE` on `kubo.audit_log`. |

### `20261031_add_audit_history_query.sql`

Adds `kubo.get_audit_history(p_entity_type, p_entity_id, p_limit, p_offset)`
for entity-specific history such as an employee or role.

## Module changes

### Employee

- `employee.schema.ts`
  - Normalizes status input, so `On Leave`, `OnLeave`, and lowercase values
    become the database enum `OnLeave`.
  - Status defaults to `Active` when omitted on create.
  - Removed `passwordHash` from the profile-update schema. Password changes now
    use the reset endpoint.
  - Added `ResetEmployeePasswordSchema`.
  - Response DTO no longer includes `passwordHash`.
- `employee.repository.ts`
  - `createEmployee` uses the new `create_employee` function and returns the
    created employee.
  - `updateEmployee` expects the safe row.
  - `deleteEmployee` reads the new boolean result.
  - Added `resetEmployeePassword`.
  - Database errors are mapped to safe application errors.
- `employee.services.ts`
  - Added `resetEmployeePasswordService`; bcrypt hashing stays in the service.
- `employee.controllers.ts`
  - Added `resetEmployeePasswordController`.
- `employee.routes.ts`
  - Added `PATCH /employees/:employeeId/password`.

### Role

- `role.schema.ts`
  - Trims role name/description and enforces database-compatible lengths.
- `role.repository.ts`
  - Uses `delete_unused_role`.
  - Maps duplicate and referenced-role database errors to safe responses.

### Audit logs

- `audit-log.repository.ts`
  - Added `getAuditHistory`, backed by `kubo.get_audit_history`.
- `audit-logs.services.ts`
  - Added `getAuditHistoryService`.
- `audit-logs.controllers.ts`
  - Added `getAuditHistoryController`.
- `audit-logs.routes.ts`
  - Added `GET /audit-logs/history/:entityType/:entityId`.

### Shared

- `utils/http.ts`
  - Added `mapDatabaseError` for common PostgreSQL error codes:
    - `23505` duplicate → `400`
    - `23503` referenced record → `409`
    - `23514` business-rule violation → `400`
    - `22023` invalid input → `400`
    - `P0002` missing record → `404`

## New API behavior

### Password reset

```http
PATCH /KUBO_Resort/Management-System/v0.0.1/employees/:employeeId/password
Content-Type: application/json

{
      "password": "NewValid1!"
}
```

The plaintext password is hashed with bcrypt in the service layer. The database
only receives the hash and never returns it.

### Audit history by entity

```http
GET /KUBO_Resort/Management-System/v0.0.1/audit-logs/history/:entityType/:entityId?page=1&limit=10
```

Example:

```http
GET /KUBO_Resort/Management-System/v0.0.1/audit-logs/history/employee/5efe3900-8a3c-4053-87f8-f6588257c7d5
```

`entityType` is required and case-insensitive. `entityId` must be a UUID. Results
are newest first and paginated in the database.

### Employee create

`status` is now optional and defaults to `Active`.

```json
{
      "roleId": "...",
      "firstName": "Temp",
      "lastName": "User",
      "username": "temp.user",
      "passwordHash": "ValidPass1!"
}
```

### Employee delete

Returns `204` on success. The repository now reports the real boolean result
from the database.

## Business-rule coverage

| Rule | Status |
|---|---|
| BR-001 — one role per employee | Preserved by FK. |
| BR-002 — required fields and unique username | Preserved; status defaults to `Active`. |
| BR-003 — password hashing and no hash exposure | Improved: safe reads and reset routine exclude `password_hash`. |
| BR-004 — status controls access | Status validation normalized; audit write still pending auth. |
| BR-005 / BR-076 / BR-077 — RBAC | Not implemented yet; requires authentication middleware. |
| BR-006 / BR-080.3 — one active Administrator | Enforced in create/update/delete routines. |
| BR-007 / BR-072 — retain employees with history | Existing reference checks retained; boolean result fixed. |
| BR-008 / BR-072 — role deletion protection | Enforced by `delete_unused_role`. |
| BR-067 / BR-068 — audit contents | Write routine added; role/employee endpoints not wired yet. |
| BR-069 — audit append-only | Enforced by triggers. |
| BR-070 — no secrets in audit/API | Safe reads fixed; audit write routine still depends on caller redaction. |
| BR-071 — atomic multi-table operations | Password/RBAC/audit integration still needs a trusted actor. |
| BR-078 — audit review | Read functions added. |

## Deferred and known limitations

1. **Audit writes are not wired into role/employee endpoints.**
   - `audit_log.employee_id` requires a trusted acting employee.
   - Authentication/RBAC does not exist yet, so accepting an actor ID from the
     request body would be unsafe.
   - The write routine and read routines are ready for wiring once authentication
     provides the actor.

2. **Role names are still stored as `ADMIN` and `STAFF`.**
   - The last-Administrator helper accepts both `ADMIN`/`Administrator`.
   - A future decision is still needed on whether to migrate the stored names to
     the business-rule labels `Administrator` and `Staff`.

3. **Existing data currently has multiple active Administrators.**
   - The new routines prevent creating another active Administrator and prevent
     removing the last one, but they do not automatically demote existing extra
     Administrators.
   - If strict one-active-Administrator enforcement is required, existing data
     must be cleaned up separately.

4. **Password policy mismatch remains.**
   - Business rules say 6–12 alphanumeric.
   - The application currently enforces 8–12 with uppercase, lowercase, number,
     and special character.
   - The stronger current application policy is retained for now.

5. **Legacy auth functions remain.**
   - `kubo.authenticate_employee` and `kubo.register_employee` use pgcrypto
     `crypt()` rather than the application's bcrypt path.
   - They should be replaced or removed before login is implemented.

6. **Validation middleware returns Express's default HTML error page.**
   - `validateBody` passes `AppError` to `next`, but there is no global Express
     error handler.
   - This is pre-existing behavior and was not changed in this hardening pass.

## Verification performed

- `npm run typecheck` — passed.
- `npm run build` — passed.
- Migrations applied successfully.
- Database tests:
  - Safe employee read excludes `password_hash`.
  - Active Staff employee create/reset/delete works.
  - Active Administrator creation is rejected when an active Administrator
    already exists.
  - Inactive Administrator creation is allowed.
  - Deactivating active Administrators works until the last one, then fails.
  - Referenced role deletion fails with a friendly conflict.
  - Case-insensitive duplicate role creation fails.
  - Unreferenced role create/delete works.
  - Audit write/read works.
  - Entity audit history returns matching records and is case-insensitive.
  - Audit `UPDATE` is blocked by the append-only trigger.
- API tests:
  - `POST /employees` returns the safe created row.
  - `GET /employees/:id` does not return `password_hash`.
  - `PATCH /employees/:id` updates and returns the safe row.
  - `PATCH /employees/:id/password` resets the password and returns the safe row.
  - `DELETE /employees/:id` returns `204`.
  - Creating an active Administrator returns `400` with the business-rule message.
  - Deleting a referenced role returns `409`.
  - Creating an employee with omitted status defaults to `Active`.
  - `GET /audit-logs/history/employee/:employeeId` returns `200`.
  - Invalid `entityId` on the history route returns `400`.
