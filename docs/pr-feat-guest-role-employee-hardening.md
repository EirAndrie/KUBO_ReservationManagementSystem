# PR: Guest, Role, and Employee Hardening

**Branch:** `feat/guest-role-employee-hardening`  
**Base:** `main`  
**Commit under review:** `8a2be19`  
**Status:** Implementation complete; required migration and shared-error files still need to be committed.

## Summary

This PR aligns the Guest, Role, and Employee modules with the agreed business
rules and database routines.

It adds:

- Safe guest lookup, creation/reuse, full profile updates, paginated search, and
  unused-guest deletion.
- Role validation, reference-safe deletion, and duplicate-name handling.
- Safe employee reads, password reset, last-active-Administrator protection, and
  stronger employee listing/update behavior.
- Shared PostgreSQL error mapping for safe API responses.

## Affected files

### Committed in `8a2be19`

| File | Change |
|---|---|
| `backend/src/modules/employee/employee.controllers.ts` | Added password-reset controller and updated list/update handling. |
| `backend/src/modules/employee/employee.routes.ts` | Added `PATCH /employees/:employeeId/password`. |
| `backend/src/modules/employee/employee.services.ts` | Added password-reset service and aligned listing/update flow. |
| `backend/src/modules/employee/repository/employee.repository.ts` | Uses hardened employee routines and safe error mapping. |
| `backend/src/modules/employee/repository/employee.schema.ts` | Safe response DTO, status normalization/default, filter schema, reset-password schema. |
| `backend/src/modules/guest/guest.controllers.ts` | Paginated listing, validated filters, reused-guest response, route-param updates. |
| `backend/src/modules/guest/guest.routes.ts` | Documented Administrator-only deletion intent. |
| `backend/src/modules/guest/guest.services.ts` | Reuse-by-email/ID flow, pagination, update/delete handling. |
| `backend/src/modules/guest/repository/guest.repository.ts` | Uses the `kubo_guest_management` functions and safe error mapping. |
| `backend/src/modules/guest/repository/guest.schema.ts` | DB enum ID types, both PH phone formats, optional address fields, corrected `zipPostalCode`. |
| `backend/src/modules/role/repository/role.repository.ts` | Uses reference-safe role deletion and safe error mapping. |
| `backend/src/modules/role/repository/role.schema.ts` | Trims/limits role name and description. |

### Required files currently uncommitted

These are needed for the committed module code to compile and for the database
routines to exist.

| File | Purpose |
|---|---|
| `backend/src/utils/http.ts` | Adds `mapDatabaseError` used by the employee, guest, and role repositories. |
| `backend/src/migrations/20261031_fix_update_employee_profile.sql` | Repairs the employee update routine. |
| `backend/src/migrations/20261031_extend_get_employees_filters.sql` | Adds role/status/search/pagination to employee listing. |
| `backend/src/migrations/20261031_harden_role_employee_management.sql` | Adds safe employee reads, password reset, last-Administrator checks, role validation, and reference-safe role deletion. |
| `backend/src/migrations/20261031_harden_guest_management.sql` | Adds guest reuse, full updates, search/list, ID uniqueness, phone validation, and unused-guest deletion. |

> The branch currently compiles only with `backend/src/utils/http.ts` from the
> working tree. That file and the four migrations above must be committed before
> opening or merging the PR. Only the migrations listed in this table belong to
> this PR; do not stage unrelated untracked files.

### Related documentation

| File | Purpose |
|---|---|
| `docs/guest-hardening.md` | Guest implementation and verification notes. |
| `docs/pr-feat-guest-role-employee-hardening.md` | This PR description. |

## Database changes

### Employee

- `get_employee_by_id` now returns a safe row without `password_hash`.
- `create_employee` returns the created safe employee row.
- `update_employee_role_status` returns a safe row and handles duplicate usernames.
- `delete_unused_employee` returns `boolean`.
- Added `reset_employee_password`.
- Added `is_administrator_role`.
- Enforced last-active-Administrator protection on create, update, deactivate,
  reassign, and delete.
- Added status input normalization and default `Active` on create.

### Role

- Added name/description trimming and length validation.
- Added case-insensitive unique role names.
- Added `delete_unused_role` with an employee-reference guard.
- Hardened `SECURITY DEFINER` search paths.

### Guest

- Added case-insensitive unique email and unique `(valid_id_type, lower(id_number))`.
- Added `fn_get_guest_by_id`, `fn_get_guest_by_email`, and
  `fn_get_guest_by_id_number`.
- Added paginated `fn_search_guests` with name/email/phone/search/ID-type filters.
- Added `fn_create_guest` with reuse by email or ID details.
- Added `fn_update_guest` for names, contact details, address, and ID details.
- Added `fn_delete_unused_guest` with reservation protection.
- Phone validation accepts `09XXXXXXXXX` and `+639XXXXXXXXX`.

## API behavior

### Employee

- `PATCH /employees/:employeeId/password` resets a password using bcrypt.
- Employee create returns the safe created row.
- Employee update and delete return accurate results.
- Employee listing supports role, status, search, and pagination.
- Responses no longer expose `password_hash` through employee reads.

### Role

- Duplicate role names return `400`.
- Deleting a role still assigned to employees returns `409`.
- Role names/descriptions are trimmed and length-validated.

### Guest

- `POST /guests` returns:
  - `201` with `reused: false` for a new guest.
  - `200` with `reused: true` for an existing guest matched by email or ID details.
- `GET /guests` is database-paginated and supports `search` and `validIdType`.
- `PATCH /guests/:guestId` updates names, email, phone, ID details, and address.
- `DELETE /guests/:guestId` deletes only unreferenced guests; referenced guests
  return `409`.
- ID types use the exact DB enum values (`NationalID`, `DriverLicense`, etc.).

## Verification

- `npm run typecheck` passed.
- `npm run build` passed.
- Migrations applied successfully.
- Employee:
  - Safe reads exclude `password_hash`.
  - Password reset works.
  - Duplicate username handling works.
  - Last-active-Administrator protection works.
- Role:
  - Duplicate names fail cleanly.
  - Referenced role deletion fails with `409`.
  - Unreferenced role deletion works.
- Guest:
  - Create returns a safe row.
  - Same email reuses the existing guest.
  - Same ID type/number reuses the existing guest.
  - Search and ID-type filtering work.
  - Names and ID details can be updated.
  - Invalid phone and duplicate email updates fail cleanly.
  - Unused guest deletion works.
  - Referenced guest deletion is blocked.

## Out of scope

- RBAC/authentication enforcement, including Administrator-only guest deletion.
- Removal of legacy `sp_*` guest routines.
