# Role Module — API Contract

Role configuration endpoints for the Kubo Reservation Management System.

- **Base path:** `/KUBO_Resort/Management-System/v0.0.1`
- **Module mount:** `/roles`
- **Source files:** `role.routes.ts`, `role.controllers.ts`, `role.services.ts`, `repository/role.schema.ts`, `repository/role.repository.ts`
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
| `Administrator` | Yes (case-insensitive) |
| Anything else | No — `403 Insufficient privileges` |

The authenticated employee must also have status `Active`; otherwise the
authentication middleware returns `403 Account is not active`.

### 1.3 Pagination

Not supported. `GET /roles` returns every role. `page` and `limit` query
parameters are ignored.

### 1.4 Success envelope

Every successful response includes:

```json
{
  "success": true,
  "message": "Human-readable result"
}
```

The payload is placed under the key **`roles`** for every successful role
endpoint. On list responses `roles` is an array; on create/get/update it is a
single role object. There is no `data` wrapper and no `count` field.

### 1.5 Role object

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `role_id` | string (UUID) | No | Primary key |
| `role_name` | string | No | Unique per role table |
| `description` | string | Yes | Stored as `NULL` when blank |

### 1.6 Error envelope

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

### 1.7 Validation behavior

Request bodies are validated with Zod before the controller runs. Validation
failures return `400` with all issues joined into one `message`, for example:

```json
{
  "success": false,
  "message": "roleName: Role name is required.; description: Role description is required"
}
```

Unknown body fields are stripped by Zod.

### 1.8 Path parameter validation

`roleId` must be a UUID matching the shared UUID pattern (versions 1–5). Invalid
values return `400 Invalid roleId format`.

### 1.9 Database error mapping

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
| `POST` | `/roles` | Create a role |
| `GET` | `/roles` | List all roles |
| `GET` | `/roles/:roleId` | Get one role |
| `PATCH` | `/roles/:roleId` | Update a role |
| `DELETE` | `/roles/:roleId` | Delete an unused role |

---

## 3. `POST /roles`

Create a role.

### 3.1 Access

Administrator only.

### 3.2 Request body

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `roleName` | string | Yes | Trimmed; 1–50 characters |
| `description` | string | Yes | Trimmed; 1–255 characters |

```json
{
  "roleName": "FrontDesk",
  "description": "Handles guest check-in and front-desk operations"
}
```

### 3.3 Success response — `201 Created`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Role: <roleName> created successfully` |
| `roles` | object | No | Created role |

```json
{
  "success": true,
  "message": "Role: FrontDesk created successfully",
  "roles": {
    "role_id": "a1b2c3d4-e5f6-4789-8abc-def012345678",
    "role_name": "FrontDesk",
    "description": "Handles guest check-in and front-desk operations"
  }
}
```

### 3.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Body fails validation | `400` | Validation detail |
| Role name already exists (service pre-check) | `400` | `Role already exists` |
| Role name duplicated during insert | `400` | `Role name already exists.` |
| Role name blank at database layer | `400` | `Role name must be between 1 and 50 characters.` |
| Description exceeds 255 characters | `400` | `Role description cannot exceed 255 characters.` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- The service pre-checks role names with a case-insensitive lookup, so
  `administrator`, `Administrator`, and `ADMINISTRATOR` collide even though the
  database unique constraint itself is case-sensitive.
- `roleName` is trimmed before storage.
- An audit row is written inside the same transaction as the insert. If the
  audit write fails, the role insert is rolled back.

### 3.5 Side effects

- Inserts one row into `kubo.role`.
- Inserts one `kubo.audit_log` row with `action = Create`, `entityType = role`,
  `entityId = role_id`.

---

## 4. `GET /roles`

List all roles.

### 4.1 Access

Administrator only.

### 4.2 Query parameters

None supported. Pagination, filtering, and search parameters are ignored.

### 4.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Roles retrieved successfully` |
| `roles` | array | No | Role objects ordered by `role_name` |

```json
{
  "success": true,
  "message": "Roles retrieved successfully",
  "roles": [
    {
      "role_id": "0d4a1e6e-5f2b-4f22-9f7a-3c7f6a1b2c34",
      "role_name": "Administrator",
      "description": "System administrator"
    },
    {
      "role_id": "a1b2c3d4-e5f6-4789-8abc-def012345678",
      "role_name": "FrontDesk",
      "description": "Handles guest check-in and front-desk operations"
    }
  ]
}
```

### 4.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| No roles exist | `404` | `No roles found` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Unexpected database failure | `500` | `Failed to list Roles from database` |

Behavior notes:

- An empty table returns `404`, not an empty array.
- There is no `count` field.

### 4.5 Side effects

None.

---

## 5. `GET /roles/:roleId`

Get one role by UUID.

### 5.1 Access

Administrator only.

### 5.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `roleId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 5.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Role: <roleName> retrieved successfully` |
| `roles` | object | No | Requested role |

```json
{
  "success": true,
  "message": "Role: Administrator retrieved successfully",
  "roles": {
    "role_id": "0d4a1e6e-5f2b-4f22-9f7a-3c7f6a1b2c34",
    "role_name": "Administrator",
    "description": "System administrator"
  }
}
```

### 5.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid roleId format` |
| Role does not exist | `404` | `Role not found` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |

### 5.5 Side effects

None.

---

## 6. `PATCH /roles/:roleId`

Update a role.

### 6.1 Access

Administrator only.

### 6.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `roleId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 6.3 Request body

Both fields are optional, but if present they must satisfy the constraints below.
There is **no** “at least one field” requirement.

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `roleName` | string | No | Trimmed; 1–50 characters |
| `description` | string | No | Trimmed; 1–255 characters |

```json
{
  "roleName": "FrontDeskSupervisor",
  "description": "Supervises front-desk operations"
}
```

### 6.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Role: <roleName> updated successfully` |
| `roles` | object | No | Updated role |

```json
{
  "success": true,
  "message": "Role: FrontDeskSupervisor updated successfully",
  "roles": {
    "role_id": "a1b2c3d4-e5f6-4789-8abc-def012345678",
    "role_name": "FrontDeskSupervisor",
    "description": "Supervises front-desk operations"
  }
}
```

### 6.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid roleId format` |
| Body fails validation | `400` | Validation detail |
| Role name blank at database layer (normally blocked by Zod) | `400` | `Role name cannot be blank.` |
| Role name already used | `400` | `Role name already exists.` |
| Role does not exist | `404` | `Role not found` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- An empty body `{}` is accepted. The database returns the role unchanged and
  still writes an update audit row.
- `roleName` and `description` are trimmed. Zod rejects a blank value when
  either field is supplied; the database routine would coerce a blank
  description to `NULL` if called directly.
- Names remain case-insensitively protected by the service layer only at create
  time; update uniqueness is enforced by the database unique constraint.
- The audit update row is written in the same transaction as the update.

### 6.6 Side effects

- Updates one `kubo.role` row.
- Inserts one `kubo.audit_log` row with `action = Update`, `entityType = role`,
  `entityId = role_id`, including old and new role snapshots.

---

## 7. `DELETE /roles/:roleId`

Delete a role that is not assigned to any employee.

### 7.1 Access

Administrator only.

### 7.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `roleId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 7.3 Request body

None.

### 7.4 Success response — `204 No Content`

No response body.

### 7.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid roleId format` |
| Role does not exist | `404` | `Role not found` |
| Role is assigned to employees | `409` | `Role is assigned to employees and cannot be deleted.` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- The service checks existence before delegating to the database routine.
- A role referenced by any employee cannot be deleted; reassign or remove those
  employees first.
- If the row disappears between the existence check and the delete, the endpoint
  still returns `204` because the boolean result is not checked.
- The delete audit row is written before the row is removed, so the acting
  employee can still be resolved.

### 7.6 Side effects

- Deletes one `kubo.role` row.
- Inserts one `kubo.audit_log` row with `action = Delete`, `entityType = role`,
  `entityId = role_id`.

---

## 8. Known contract quirks

- Responses use snake_case keys (`role_id`, `role_name`), matching raw database
  rows, while the TypeScript response DTO uses camelCase names.
- The `roles` key holds an **object** on create/get/update and an **array** on list.
- `GET /roles` returns `404` when the table is empty and never returns `count`.
- There is no pagination or filtering for roles.
- `PATCH /roles/:roleId` accepts `{}` and returns the unchanged role.
- Role-name uniqueness is pre-checked case-insensitively but enforced
  case-sensitively by the database unique constraint.
- `DELETE` returns `204` but the controller calls `res.status(204).json()`; clients
  must treat it as an empty `204`.
