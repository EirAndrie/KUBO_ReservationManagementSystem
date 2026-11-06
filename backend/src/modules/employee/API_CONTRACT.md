# Employee Module — API Contract

Employee account management endpoints for the Kubo Reservation Management System.

- **Base path:** `/KUBO_Resort/Management-System/v0.0.1`
- **Module mount:** `/employees`
- **Source files:** `employee.routes.ts`, `employee.controllers.ts`, `employee.services.ts`, `repository/employee.schema.ts`, `repository/employee.repository.ts`
- **Authentication:** All endpoints require a Bearer access token.
- **Authorization:** All endpoints require the **Administrator** business role.

> This document describes the API as implemented. Response keys are shown exactly
> as they appear on the wire.

---

## 1. Common conventions

### 1.1 Request headers

| Header | Required | Value |
|---|---|---|
| `Content-Type` | For requests with a body | `application/json` |
| `Authorization` | Always | `Bearer <accessToken>` |

### 1.2 Access control

| Stored `role_name` | Administrator access |
|---|---|
| `Admin` | Yes |
| `Administrator` | Yes (stored `role_name` equals `administrator`, exact) |
| Anything else | No — `403 Insufficient privileges` |

The authenticated employee must also have status `Active`; otherwise the
authentication middleware returns `403 Account is not active`.

### 1.3 Pagination

List endpoints accept:

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |

Pagination is performed in the database. `count` is the number of rows returned
for the current page, not the total number of matching employees.

### 1.4 Success envelope

Every successful response includes:

```json
{
  "success": true,
  "message": "Human-readable result"
}
```

Employee payloads are placed under the key **`employees`**. On list responses it
is an array; on create/get/update/password-reset it is a single object. There is
no `data` wrapper.

### 1.5 Employee object shapes

Two different row shapes are returned:

**List row** (`GET /employees`):

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `employee_id` | string (UUID) | No | |
| `first_name` | string | No | |
| `last_name` | string | No | |
| `username` | string | No | |
| `role_id` | string (UUID) | No | |
| `role_name` | string | No | Included only on list responses |
| `status` | string | No | Employee status enum |
| `created_at` | string (ISO 8601) | No | |
| `updated_at` | string (ISO 8601) | No | |

**Detail row** (`GET /employees/:employeeId`, create, update, password reset):

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `employee_id` | string (UUID) | No | |
| `role_id` | string (UUID) | No | |
| `first_name` | string | No | |
| `last_name` | string | No | |
| `username` | string | No | |
| `status` | string | No | Employee status enum |
| `created_at` | string (ISO 8601) | No | |
| `updated_at` | string (ISO 8601) | No | |

`password_hash` is never returned.

### 1.6 Employee status values

| API value | Accepted aliases |
|---|---|
| `Active` | `active` |
| `Inactive` | `inactive` |
| `Suspended` | `suspended` |
| `OnLeave` | `onleave`, `on leave` |
| `Terminated` | `terminated` |

Aliases are trimmed, lowercased, and stripped of spaces before matching.

### 1.7 Error envelope

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

### 1.8 Validation behavior

Request bodies are validated with Zod before the controller runs. Validation
failures return `400` with all issues joined into one `message`. Unknown body
fields are stripped by Zod.

### 1.9 Path parameter validation

`employeeId` must be a UUID matching the shared UUID pattern (versions 1–5).
Invalid values return `400 Invalid employeeId format`.

### 1.10 Database error mapping

| PostgreSQL code | HTTP status |
|---|---:|
| `23505` | `400` |
| `23503` | `409` |
| `23514` | `400` |
| `22023` | `400` |
| `P0002` | `404` |
| `42501` | `403` |
| Any other code | `500` |

---

## 2. Endpoint summary

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/employees` | Create an employee |
| `GET` | `/employees` | List/filter employees |
| `GET` | `/employees/:employeeId` | Get one employee |
| `PATCH` | `/employees/:employeeId/password` | Reset an employee password |
| `PATCH` | `/employees/:employeeId` | Update an employee |
| `DELETE` | `/employees/:employeeId` | Delete an unused employee |

The password route is registered before the generic `PATCH /:employeeId` route
so it is not shadowed.

---

## 3. `POST /employees`

Create an employee account.

### 3.1 Access

Administrator only.

### 3.2 Request body

| Field | Type | Required | Default | Constraints |
|---|---|---:|---|---|
| `roleId` | string (UUID) | Yes | — | Must reference an existing role |
| `firstName` | string | Yes | — | Trimmed; 1–100 characters at the database layer |
| `lastName` | string | Yes | — | Trimmed; 1–100 characters at the database layer |
| `username` | string | Yes | — | Trimmed; 1–100 characters; unique |
| `passwordHash` | string | Yes | — | **Plaintext password**; 8–12 characters with uppercase, lowercase, digit, and one of `@ $ ! % * ? &` |
| `status` | string | No | `Active` | Employee status value or alias |

```json
{
  "roleId": "a1b2c3d4-e5f6-4789-8abc-def012345678",
  "firstName": "Metch",
  "lastName": "Amores",
  "username": "mamores",
  "passwordHash": "Secret123!",
  "status": "Active"
}
```

> **Important:** despite its name, `passwordHash` carries the **plaintext**
> password from the client. The service hashes it with bcrypt (cost 12) before
> it reaches the database.

### 3.3 Success response — `201 Created`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Employee created successfully` |
| `employees` | object | No | Detail row; does not include `role_name` |

```json
{
  "success": true,
  "message": "Employee created successfully",
  "employees": {
    "employee_id": "b52b52f5-14a4-442e-b836-81f8f0e8c476",
    "role_id": "a1b2c3d4-e5f6-4789-8abc-def012345678",
    "first_name": "Metch",
    "last_name": "Amores",
    "username": "mamores",
    "status": "Active",
    "created_at": "2026-11-04T08:15:00.000Z",
    "updated_at": "2026-11-04T08:15:00.000Z"
  }
}
```

### 3.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Body fails validation | `400` | Validation detail |
| Username already exists (service pre-check) | `400` | `Username already exists, try another username` |
| Username duplicated during insert | `400` | `Employee username already exists.` |
| Role does not exist | `404` | `Employee role does not exist.` |
| Creating an active Administrator while one already exists | `400` | `At most one active Administrator is allowed.` |
| Names/username blank or over 100 characters | `400` | `Valid names, username and status are required.` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- The service hashes the supplied plaintext with bcrypt cost 12.
- Usernames are pre-checked before insertion; the database also enforces a unique
  username constraint.
- Names and username are trimmed by the database routine.
- At most one **active Administrator** is allowed. The check applies only when
  creating an `Active` employee whose role is `Admin`/`Administrator`.
- The create and audit rows are written in the same transaction.

### 3.5 Side effects

- Inserts one row into `kubo.employee`.
- Inserts one `kubo.audit_log` row with `action = Create`, `entityType = employee`,
  `entityId = employee_id`, using a safe snapshot that excludes `password_hash`.

---

## 4. `GET /employees`

List and filter employees.

### 4.1 Access

Administrator only.

### 4.2 Query parameters

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |
| `role` | string | — | Role UUID or role name; name match is case-insensitive |
| `status` | string | — | Employee status value or alias |
| `search` | string | — | 1–100 characters; case-insensitive match on first name, last name, or username |

Empty-string values for `role`, `status`, and `search` are treated as not supplied.

### 4.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `count` | integer | No | Number of rows on this page |
| `message` | string | No | `Successfully listed employees` |
| `employees` | array | No | List rows, ordered by `last_name`, `first_name`, `employee_id` |

```json
{
  "success": true,
  "count": 2,
  "message": "Successfully listed employees",
  "employees": [
    {
      "employee_id": "b52b52f5-14a4-442e-b836-81f8f0e8c476",
      "first_name": "Metch",
      "last_name": "Amores",
      "username": "mamores",
      "role_id": "a1b2c3d4-e5f6-4789-8abc-def012345678",
      "role_name": "Staff",
      "status": "Active",
      "created_at": "2026-11-04T08:15:00.000Z",
      "updated_at": "2026-11-04T08:15:00.000Z"
    }
  ]
}
```

### 4.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid pagination or filter values | `400` | Validation detail |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Unexpected database failure | `500` | `Failed to fetch employees from database` |

Behavior notes:

- No rows is a successful `200` with an empty array and `count: 0`.
- `count` is page size, not total matches.
- `role` accepts either a role name or a role UUID.
- `role_name` is present only on list rows.

### 4.5 Side effects

None.

---

## 5. `GET /employees/:employeeId`

Get one employee by UUID.

### 5.1 Access

Administrator only.

### 5.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `employeeId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 5.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully fetched Employee by its ID` |
| `employees` | object | No | Detail row; does not include `role_name` |

```json
{
  "success": true,
  "message": "Successfully fetched Employee by its ID",
  "employees": {
    "employee_id": "b52b52f5-14a4-442e-b836-81f8f0e8c476",
    "role_id": "a1b2c3d4-e5f6-4789-8abc-def012345678",
    "first_name": "Metch",
    "last_name": "Amores",
    "username": "mamores",
    "status": "Active",
    "created_at": "2026-11-04T08:15:00.000Z",
    "updated_at": "2026-11-04T08:15:00.000Z"
  }
}
```

### 5.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid employeeId format` |
| Employee does not exist | `404` | `Employee not found` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |

### 5.5 Side effects

None.

---

## 6. `PATCH /employees/:employeeId/password`

Reset an employee password.

### 6.1 Access

Administrator only.

### 6.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `employeeId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 6.3 Request body

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `password` | string | Yes | 8–12 characters; at least one uppercase, one lowercase, one digit, and one of `@ $ ! % * ? &` |

```json
{
  "password": "NewSecret1!"
}
```

### 6.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully reset Employee password` |
| `employees` | object | No | Detail row of the affected employee |

### 6.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid employeeId format` |
| Password fails complexity rules | `400` | Validation detail |
| Employee does not exist | `404` | `Employee not found` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- The plaintext is hashed with bcrypt cost 12 in the service; only the hash reaches
  the database.
- The password is never returned.
- Password reset does not change status, role, or force logout. Existing JWTs remain
  valid until expiry.

### 6.6 Side effects

- Updates `password_hash` and `updated_at` on `kubo.employee`.
- Inserts one `kubo.audit_log` row with `action = Update`, `entityType = employee`,
  `entityId = employee_id`, description `Reset password for employee <username>`.
  The audit snapshot excludes `password_hash`.

---

## 7. `PATCH /employees/:employeeId`

Update employee profile, role, or status.

### 7.1 Access

Administrator only.

### 7.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `employeeId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 7.3 Request body

All fields are optional, but **at least one** must be supplied. `passwordHash` is
not accepted here; use the password-reset endpoint.

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `roleId` | string (UUID) | No | Must reference an existing role |
| `firstName` | string | No | Trimmed; 1–100 characters at the database layer |
| `lastName` | string | No | Trimmed; 1–100 characters at the database layer |
| `username` | string | No | Trimmed; 1–100 characters; unique |
| `status` | string | No | Employee status value or alias |

```json
{
  "roleId": "0d4a1e6e-5f2b-4f22-9f7a-3c7f6a1b2c34",
  "firstName": "Metch",
  "lastName": "Amores",
  "username": "mamores",
  "status": "OnLeave"
}
```

### 7.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successully updated Employee` (spelling as implemented) |
| `employees` | object | No | Detail row; does not include `role_name` |

### 7.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid employeeId format` |
| Body fails Zod validation | `400` | Validation detail |
| Empty body | `400` | `Supply at least one field to update.` |
| Blank name/username | `400` | `First name...` / `Last name...` / `Username...` |
| Username already taken | `400` | `Employee username already exists.` |
| Replacement role does not exist | `404` | `Replacement role does not exist.` |
| Employee does not exist | `404` | `Employee not found` |
| Creating a second active Administrator | `400` | `At most one active Administrator is allowed.` |
| Deactivating/reassigning the last active Administrator | `400` | `The last active Administrator cannot be deactivated or reassigned.` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- The service checks existence and then delegates to the database routine.
- The database enforces the last-active-Administrator rules. If the target is the
  only active administrator, it cannot be deactivated or moved to a non-admin role.
- If another active administrator exists, promoting this employee to active
  Administrator is rejected.
- Usernames are checked for uniqueness only when changed.
- Names and username are trimmed; blank values are rejected.
- All updates and the audit row are written in one transaction.

### 7.6 Side effects

- Updates one `kubo.employee` row.
- Inserts one `kubo.audit_log` row with `action = Update`, `entityType = employee`,
  `entityId = employee_id`, including safe old/new snapshots.

---

## 8. `DELETE /employees/:employeeId`

Delete an employee that has no history.

### 8.1 Access

Administrator only.

### 8.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `employeeId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 8.3 Request body

None.

### 8.4 Success response — `204 No Content`

No response body.

### 8.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid employeeId format` |
| Employee does not exist | `404` | `Employee not found` |
| Target is the last active Administrator | `400` | `The last active Administrator cannot be deleted.` |
| Employee has history | `409` | `Employee has history; retain the record.` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- “History” means any row in `kubo.reservation`, `kubo.payment`,
  `kubo.additional_charge`, or `kubo.audit_log` that references the employee.
- Because successful logins and most mutations write audit rows, most real
  employees cannot be deleted. Prefer setting `status` to `Inactive` or
  `Terminated`.
- The delete audit row is written before the row is removed, so the acting
  employee can still be resolved.
- If the row disappears between the existence check and the delete, the endpoint
  still returns `204` because the boolean result is not checked.

### 8.6 Side effects

- Deletes one `kubo.employee` row.
- Inserts one `kubo.audit_log` row with `action = Delete`, `entityType = employee`,
  `entityId = employee_id`.

---

## 9. Known contract quirks

- `POST /employees` expects the **plaintext** password in a field named
  `passwordHash`.
- List rows include `role_name`; detail, create, update, and password-reset rows do
  not.
- Responses use snake_case keys, while the TypeScript response DTO uses camelCase
  names.
- `PATCH /employees/:employeeId` accepts `{}` at the Zod layer but the database
  rejects it with `400 Supply at least one field to update.`
- `firstName`, `lastName`, and `username` have no Zod length limits; the database
  enforces 1–100 characters and trims values.
- Status values accept aliases such as `on leave` and `onleave`.
- `count` on the list endpoint is the returned page size, not a total.
- Delete is effectively unavailable for any employee with audit history.
- `DELETE` returns `204` but the controller calls `res.status(204).json()`; clients
  must treat it as an empty `204`.
- The update success message contains the implemented spelling
  `Successully updated Employee`.
