# Audit Logs Module — API Contract

Read-only audit-log endpoints for the Kubo Reservation Management System.

- **Base path:** `/KUBO_Resort/Management-System/v0.0.1`
- **Module mount:** `/audit-logs`
- **Source files:** `audit-logs.routes.ts`, `audit-logs.controllers.ts`, `audit-logs.services.ts`, `repository/audit-log.schema.ts`, `repository/audit-log.repository.ts`
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

`router.use(authorizeRoles("Administrator"))` protects the entire module.

| Stored `role_name` | Access |
|---|---|
| `Admin` | Yes |
| `Administrator` | Yes (case-insensitive) |
| Anything else | No — `403 Insufficient privileges` |

The authenticated employee must have status `Active`; otherwise the authentication
middleware returns `403 Account is not active`.

### 1.3 Pagination

All list endpoints accept:

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |

Pagination is performed in the database. `count` is the number of rows returned
for the current page, not the total number of matching audit rows.

### 1.4 Success envelope

Every successful response includes:

```json
{
  "success": true,
  "message": "Human-readable result"
}
```

Audit payloads are placed under the key **`auditLogs`**. On list/history responses
it is an array; on get-by-ID it is an object. There is no `data` wrapper.

### 1.5 Audit log object

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `audit_id` | string (UUID) | No | Primary key |
| `employee_id` | string (UUID) | No | Acting employee |
| `action` | string | No | See §1.6 |
| `entity_type` | string | No | Free-form entity name, e.g. `reservation`, `payment` |
| `entity_id` | string (UUID) | No | Affected entity |
| `description` | string | Yes | Human-readable event description |
| `old_values` | object | Yes | Snapshot before the mutation |
| `new_values` | object | Yes | Snapshot after the mutation |
| `created_at` | string (ISO 8601) | No | Event timestamp |

`old_values` and `new_values` are module-specific JSON snapshots. Password hashes are
never included. Guest ID numbers are masked in guest snapshots.

### 1.6 Audit actions

`Create`, `Update`, `Delete`, `Login`, `Logout`, `Cancel`, `Approve`, `Reject`.

Filter input is normalized to title case before validation: the first character is
uppercased and the rest lowercased. For example, `login`, `LOGIN`, and `Login` all
match `Login`.

### 1.7 Error envelope

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

### 1.8 Validation behavior

Query filters are validated with Zod in the controller. Validation failures return
`400` with all issues joined into one `message`.

Empty-string values for `employeeId`, `action`, `entityType`, `entityId`,
`createdFrom`, and `createdTo` are treated as not supplied.

### 1.9 Path parameter validation

`auditId`, `entityId`, and `employeeId` must be UUIDs matching the shared UUID
pattern (versions 1–5). Invalid values return `400 Invalid <param> format`.

`entityType` is a path string; it must be non-empty.

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
| `GET` | `/audit-logs` | Filtered, paginated audit-log search |
| `GET` | `/audit-logs/:auditId` | Get one audit row |
| `GET` | `/audit-logs/history/:entityType/:entityId` | History for one entity |
| `GET` | `/audit-logs/employees/:employeeId/audit-logs` | Audit rows for one employee |

There are **no write endpoints**. Audit rows are created by the other modules and are
append-only (`UPDATE`, `DELETE`, and `TRUNCATE` are blocked by database triggers).

---

## 3. `GET /audit-logs`

Search audit logs.

### 3.1 Access

Administrator only.

### 3.2 Query parameters

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |
| `employeeId` | string (UUID) | — | Exact acting employee |
| `action` | string | — | One of the values in §1.6; case-normalized |
| `entityType` | string | — | 1–255 characters; exact case-insensitive match |
| `entityId` | string (UUID) | — | Exact affected entity |
| `createdFrom` | date/time | — | Inclusive lower bound on `created_at` |
| `createdTo` | date/time | — | Inclusive upper bound on `created_at`; must not be earlier than `createdFrom` |

### 3.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `count` | integer | No | Number of rows on this page |
| `message` | string | No | `Successfully fetched Audit Logs` |
| `auditLogs` | array | No | Ordered by `created_at` descending, then `audit_id` |

```json
{
  "success": true,
  "count": 1,
  "message": "Successfully fetched Audit Logs",
  "auditLogs": [
    {
      "audit_id": "a1b2c3d4-e5f6-4789-8abc-def012345678",
      "employee_id": "b52b52f5-14a4-442e-b836-81f8f0e8c476",
      "action": "Update",
      "entity_type": "reservation",
      "entity_id": "5be2d27d-a10e-440a-acab-95b8020bfecf",
      "description": "Confirmed reservation RES-20261104-7594",
      "old_values": {
        "status": "Pending"
      },
      "new_values": {
        "status": "Confirmed"
      },
      "created_at": "2026-11-04T09:45:00.000Z"
    }
  ]
}
```

### 3.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid pagination or filter values | `400` | Validation detail |
| `createdTo` earlier than `createdFrom` | `400` | `createdTo must not be earlier than createdFrom` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Unexpected database failure | `500` | `Failed to search audit logs` |

Behavior notes:

- No rows returns `200`, `count: 0`, and `[]`.
- `count` is page size, not total matches.
- `entityType` is matched with case-insensitive equality, not a substring search.
- Date-time filters are compared as timestamps.

### 3.5 Side effects

None.

---

## 4. `GET /audit-logs/:auditId`

Get one audit row by UUID.

### 4.1 Access

Administrator only.

### 4.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `auditId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 4.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully fetched Audit Log by its ID` |
| `auditLogs` | object | No | Audit row |

### 4.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid auditId format` |
| Audit row does not exist | `404` | `Audit log not found` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |

### 4.5 Side effects

None.

---

## 5. `GET /audit-logs/history/:entityType/:entityId`

Return the audit history for one entity, newest first.

### 5.1 Access

Administrator only.

### 5.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `entityType` | string | Yes | Non-empty; matched case-insensitively |
| `entityId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 5.3 Query parameters

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |

### 5.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `count` | integer | No | Number of rows on this page |
| `message` | string | No | `Successfully fetched Audit Log history` |
| `auditLogs` | array | No | Ordered by `created_at` descending, then `audit_id` |

### 5.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID or pagination | `400` | Validation detail |
| Empty entity type | `400` | `Audit entity type is required.` |
| Missing entity ID | `400` | `Audit entity ID is required.` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Unexpected database failure | `500` | `Failed to get audit history` |

Behavior notes:

- No matching rows returns `200`, `count: 0`, and `[]`.
- There is no `404` for an unknown entity; only malformed parameters fail.
- `entityType` matching is case-insensitive.

### 5.6 Side effects

None.

---

## 6. `GET /audit-logs/employees/:employeeId/audit-logs`

Return audit rows for one employee.

### 6.1 Access

Administrator only.

### 6.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `employeeId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 6.3 Query parameters

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |
| `action` | string | — | One of the values in §1.6; case-normalized |
| `entityType` | string | — | 1–255 characters; exact case-insensitive match |

### 6.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `count` | integer | No | Number of rows on this page |
| `message` | string | No | `Successfully fetched Audit Logs related to Employee` |
| `auditLogs` | array | No | Ordered by `created_at` descending, then `audit_id` |

### 6.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID, pagination, or filter | `400` | Validation detail |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Unexpected database failure | `500` | `Failed to search audit logs` |

Behavior notes:

- The endpoint does not verify that the employee exists; an unknown employee simply
  returns `200` with an empty array.
- It forces `employeeId` from the path; a query-string `employeeId` is ignored.
- Only `action` and `entityType` filters are supported here.

### 6.6 Side effects

None.

---

## 7. Known contract quirks

- The module is read-only. There is no API to create, update, or delete audit rows.
- `auditLogs` is an object for get-by-ID and an array for list/history responses.
- `count` is page size, not total.
- `action` input is title-cased before validation, so `LOGIN` and `login` are
  accepted.
- `entityType` matching is exact (case-insensitive), not a substring search.
- Entity history and employee-scoped logs return `200 []` for unknown IDs.
- `old_values` and `new_values` shapes differ per module and are not a stable
  cross-module schema.
- Password hashes are never written to audit snapshots; guest ID numbers are masked.
- Audit rows are append-only; database triggers reject updates, deletes, and
  truncates.
