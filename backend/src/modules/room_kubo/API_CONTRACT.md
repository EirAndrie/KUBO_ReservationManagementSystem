# Kubo Module — API Contract

Kubo (accommodation unit) endpoints for the Kubo Reservation Management System.

- **Base path:** `/KUBO_Resort/Management-System/v0.0.1`
- **Module mount:** `/kubos`
- **Source files:** `kubo.routes.ts`, `kubo.controllers.ts`, `kubo.services.ts`, `repository/kubo.schema.ts`, `repository/kubo.repository.ts`
- **Authentication:** All endpoints require a Bearer access token.
- **Authorization:** Reads are open to any authenticated employee. Mutations require **Administrator**.

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

| Operation | Required business role |
|---|---|
| All `GET` endpoints | Any authenticated employee |
| `POST`, `PATCH`, `DELETE` | `Administrator` (`Admin` or `Administrator`, case-insensitive) |

The authenticated employee must have status `Active`; otherwise the authentication
middleware returns `403 Account is not active`.

### 1.3 Pagination

The list endpoints accept:

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |

`GET /kubos` and `GET /kubos/type/:kuboTypeId` paginate in the database.
`GET /kubos/available` is **not paginated**.

### 1.4 Success envelope

Every successful response includes:

```json
{
  "success": true,
  "message": "Human-readable result"
}
```

Kubo payloads are placed under the key **`kubos`**. On list responses it is an
array; on create/get/update/status-change it is a single object. There is no
`data` wrapper.

### 1.5 Kubo object

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `kubo_id` | string (UUID) | No | Primary key |
| `kubo_number` | string | No | Unique; 1–20 characters |
| `kubo_type_id` | string (UUID) | No | |
| `type_name` | string | No | Joined from `kubo_type` |
| `capacity` | integer | No | Joined from `kubo_type` |
| `price_per_night` | string (decimal) | No | PostgreSQL `numeric` is serialized as a JSON string, e.g. `"2500.00"` |
| `status` | string | No | See §1.6 |

### 1.6 Kubo status values

`Available`, `Reserved`, `Occupied`, `Maintenance`, `OutOfService`, `Cleaning`,
`UnderInspection`.

### 1.7 Error envelope

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

### 1.8 Request field aliases

Create and update bodies accept these aliases:

| Contract field | Accepted aliases |
|---|---|
| `kuboTypeId` | `kubo_type_id` |
| `kuboNumber` | `kubo_number`, `kuboRoomNumber` |
| `status` | `kuboStatus`, `kubo_status` (create only) |

The response always uses snake_case.

### 1.9 Validation behavior

Request bodies are validated with Zod before the controller runs. Validation
failures return `400` with all issues joined into one `message`. Unknown body
fields are stripped by Zod.

### 1.10 Path parameter validation

`kuboId` and `kuboTypeId` must be UUIDs matching the shared UUID pattern
(versions 1–5). Invalid values return `400 Invalid <param> format`.

### 1.11 Database error mapping

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

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/kubos` | Administrator | Create a kubo |
| `GET` | `/kubos` | Authenticated | List/search kubos |
| `GET` | `/kubos/available` | Authenticated | Find kubos available for a date range |
| `GET` | `/kubos/type/:kuboTypeId` | Authenticated | List kubos of one type |
| `GET` | `/kubos/:kuboId` | Authenticated | Get one kubo |
| `PATCH` | `/kubos/:kuboId/status` | Administrator | Change kubo status |
| `PATCH` | `/kubos/:kuboId` | Administrator | Update number/type |
| `DELETE` | `/kubos/:kuboId` | Administrator | Delete an unused kubo |

`/available` and `/type/:kuboTypeId` are registered before `/:kuboId` so they are
not shadowed by the UUID route.

---

## 3. `POST /kubos`

Create a kubo.

### 3.1 Access

Administrator only.

### 3.2 Request body

| Field | Type | Required | Default | Constraints |
|---|---|---:|---|---|
| `kuboTypeId` | string (UUID) | Yes | — | Must reference an existing kubo type |
| `kuboNumber` | string | Yes | — | Trimmed; 1–20 characters; unique |
| `status` | string | No | `Available` | Only `Available`, `Maintenance`, or `OutOfService` are accepted at creation |

```json
{
  "kuboTypeId": "d1e2f3a4-b5c6-4789-8abc-def012345678",
  "kuboNumber": "K-101",
  "status": "Available"
}
```

### 3.3 Success response — `201 Created`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully created Kubo` |
| `kubos` | object | No | Created kubo |

```json
{
  "success": true,
  "message": "Successfully created Kubo",
  "kubos": {
    "kubo_id": "e1f2a3b4-c5d6-4789-8abc-def012345678",
    "kubo_number": "K-101",
    "kubo_type_id": "d1e2f3a4-b5c6-4789-8abc-def012345678",
    "type_name": "Family Kubo",
    "capacity": 4,
    "price_per_night": "2500.00",
    "status": "Available"
  }
}
```

### 3.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Body fails validation | `400` | Validation detail |
| Number blank or over 20 characters | `400` | `Kubo number must contain 1 to 20 characters.` |
| Initial status is not `Available`, `Maintenance`, or `OutOfService` | `400` | `Invalid initial Kubo status.` |
| Number already exists | `400` | `Kubo number already exists.` |
| Kubo type does not exist | `404` | `Kubo type does not exist.` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- The Zod enum accepts all seven status values, but the database rejects
  `Reserved`, `Occupied`, `Cleaning`, and `UnderInspection` at creation.
- Number is trimmed and checked for uniqueness.
- The insert and audit row are written in one transaction.

### 3.5 Side effects

- Inserts one `kubo.kubo` row.
- Inserts one `kubo.audit_log` row with `action = Create`, `entityType = kubo`,
  `entityId = kubo_id`.

---

## 4. `GET /kubos`

List or search kubos.

### 4.1 Access

Any authenticated employee.

### 4.2 Query parameters

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |
| `search` | string | — | Trimmed; 1–100 characters; matches `kubo_number` or `type_name` |
| `kuboTypeId` | string (UUID) | — | Filters by exact type |
| `status` | string | — | One of the values in §1.6 |

Empty-string filter values are treated as not supplied.

### 4.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `count` | integer | No | Number of rows on this page |
| `message` | string | No | `Successfully listed all kubos` |
| `kubos` | array | No | Ordered by `kubo_number`, `kubo_id` |

```json
{
  "success": true,
  "count": 1,
  "message": "Successfully listed all kubos",
  "kubos": [
    {
      "kubo_id": "e1f2a3b4-c5d6-4789-8abc-def012345678",
      "kubo_number": "K-101",
      "kubo_type_id": "d1e2f3a4-b5c6-4789-8abc-def012345678",
      "type_name": "Family Kubo",
      "capacity": 4,
      "price_per_night": "2500.00",
      "status": "Available"
    }
  ]
}
```

### 4.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid pagination or filter values | `400` | Validation detail |
| Not authenticated | `401` | `Authentication required` |
| Unexpected database failure | `500` | `Failed to search kubos in database` |

Behavior notes:

- No rows returns `200` with an empty array and `count: 0`.
- `count` is page size, not total matches.

### 4.5 Side effects

None.

---

## 5. `GET /kubos/available`

Find kubos that can be booked for a date range.

### 5.1 Access

Any authenticated employee.

### 5.2 Query parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `checkIn` | date | Yes | ISO date or date-time string; converted to `YYYY-MM-DD` |
| `checkOut` | date | Yes | Must be later than `checkIn`; converted to `YYYY-MM-DD` |
| `kuboTypeId` | string (UUID) | No | Filters by exact type |

### 5.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully fetched available kubos` |
| `kubos` | array | No | No `count`; ordered by `kubo_number`, `kubo_id` |

```json
{
  "success": true,
  "message": "Successfully fetched available kubos",
  "kubos": [
    {
      "kubo_id": "e1f2a3b4-c5d6-4789-8abc-def012345678",
      "kubo_number": "K-101",
      "kubo_type_id": "d1e2f3a4-b5c6-4789-8abc-def012345678",
      "type_name": "Family Kubo",
      "capacity": 4,
      "price_per_night": "2500.00",
      "status": "Available"
    }
  ]
}
```

### 5.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Missing/invalid date or checkout not after check-in | `400` | Validation detail |
| Check-in date is in the past | `400` | `Check-in date cannot be in the past.` |
| Not authenticated | `401` | `Authentication required` |
| Unexpected database failure | `500` | `Failed to fetch available kubos from database` |

Availability rules:

- Includes kubos whose status is `Available`, `Reserved`, or `Occupied`.
- Includes `Cleaning` kubos only when check-in is after today.
- Excludes statuses `Maintenance`, `OutOfService`, and `UnderInspection`.
- Excludes kubos with overlapping `Reserved`/`CheckedIn` assignments on
  `Pending`, `Confirmed`, or `CheckedIn` reservations.
- Excludes currently `CheckedIn` assignments when check-in is today or earlier.
- Returned `status` is the kubo’s current status; a `Reserved` kubo can still be
  returned when it has no overlap with the requested range.

### 5.5 Side effects

None.

---

## 6. `GET /kubos/type/:kuboTypeId`

List kubos belonging to one kubo type.

### 6.1 Access

Any authenticated employee.

### 6.2 Path and query parameters

| Parameter | Location | Type | Default | Constraints |
|---|---|---|---|---|
| `kuboTypeId` | path | string (UUID) | — | Must match the shared UUID pattern |
| `page` | query | integer | `1` | Positive |
| `limit` | query | integer | `10` | Positive, maximum `100` |

### 6.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully fetched kubos by type` |
| `kubos` | array | No | **No `count` field**, even though pagination applies |

### 6.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID or pagination | `400` | Validation detail |
| Not authenticated | `401` | `Authentication required` |
| Unexpected database failure | `500` | `Failed to search kubos in database` |

### 6.5 Side effects

None.

---

## 7. `GET /kubos/:kuboId`

Get one kubo by UUID.

### 7.1 Access

Any authenticated employee.

### 7.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `kuboId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 7.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully fetched kubo by its ID` |
| `kubos` | object | No | Requested kubo |

### 7.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid kuboId format` |
| Kubo does not exist | `404` | `Kubo not found` |
| Not authenticated | `401` | `Authentication required` |

### 7.5 Side effects

None.

---

## 8. `PATCH /kubos/:kuboId/status`

Change a kubo’s operational status.

### 8.1 Access

Administrator only.

### 8.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `kuboId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 8.3 Request body

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `status` | string | Yes | One of the values in §1.6 |

```json
{
  "status": "Cleaning"
}
```

### 8.4 Allowed status transitions

| From | Allowed to |
|---|---|
| `Available` | `Reserved`, `Occupied`, `Cleaning`, `Maintenance`, `UnderInspection`, `OutOfService` |
| `Reserved` | `Occupied`, `Available`, `Maintenance`, `UnderInspection`, `OutOfService` |
| `Occupied` | `Cleaning`, `Maintenance`, `UnderInspection`, `OutOfService` |
| `Cleaning` | `Available`, `Maintenance`, `UnderInspection`, `OutOfService` |
| `Maintenance` | `Available` |
| `UnderInspection` | `Available` |
| `OutOfService` | `Available` |

Setting the same status is a no-op that returns the current kubo.

### 8.5 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully changed kubo status` |
| `kubos` | object | No | Updated kubo |

### 8.6 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID or missing status | `400` | Validation detail |
| Invalid transition | `400` | `Invalid Kubo status transition from <from> to <to>.` |
| Kubo does not exist | `404` | `Kubo not found` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Same-status requests return `200` without writing an audit row.
- Status changes and the audit row are written in one transaction.

### 8.7 Side effects

- Updates `kubo.kubo.status`.
- Inserts one `kubo.audit_log` row with `action = Update`, `entityType = kubo`,
  `entityId = kubo_id`, including old/new snapshots. No audit row is written for a
  same-status no-op.

---

## 9. `PATCH /kubos/:kuboId`

Update kubo number or type. Status is **not** changed here.

### 9.1 Access

Administrator only.

### 9.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `kuboId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 9.3 Request body

All fields are optional, but **at least one** of `kuboNumber` / `kuboTypeId` must
be supplied. A `status` field is stripped and ignored.

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `kuboNumber` | string | No | Trimmed; 1–20 characters; unique |
| `kuboTypeId` | string (UUID) | No | Must reference an existing kubo type |

```json
{
  "kuboNumber": "K-102",
  "kuboTypeId": "d1e2f3a4-b5c6-4789-8abc-def012345678"
}
```

### 9.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully updated kubo` |
| `kubos` | object | No | Updated kubo |

### 9.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid kuboId format` |
| Body fails Zod validation | `400` | Validation detail |
| Empty body | `400` | `Provide at least one field to update.` |
| Number blank or over 20 characters | `400` | `Kubo number must contain 1 to 20 characters.` |
| Number already exists | `400` | `Kubo number already exists.` |
| Kubo type does not exist | `404` | `Kubo type does not exist.` |
| Kubo does not exist | `404` | `Kubo not found` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Sending `status` to this endpoint has no effect; use
  `PATCH /kubos/:kuboId/status`.
- Updates and the audit row are written in one transaction.

### 9.6 Side effects

- Updates one `kubo.kubo` row.
- Inserts one `kubo.audit_log` row with `action = Update`, `entityType = kubo`,
  `entityId = kubo_id`, including old/new snapshots.

---

## 10. `DELETE /kubos/:kuboId`

Delete a kubo that has no assignment history.

### 10.1 Access

Administrator only.

### 10.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `kuboId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 10.3 Request body

None.

### 10.4 Success response — `204 No Content`

No response body.

### 10.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid kuboId format` |
| Kubo does not exist | `404` | `Kubo not found` |
| Kubo has assignment history | `409` | `Kubo has assignment history. Set its status to OutOfService instead of deleting it.` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Any row in `kubo.reserved_kubo` blocks deletion.
- Kubos with history should be retired by changing status to `OutOfService`.
- The service checks existence before the database routine and also checks the
  boolean result afterward.
- The delete audit row is written before the row is removed.

### 10.6 Side effects

- Deletes one `kubo.kubo` row.
- Inserts one `kubo.audit_log` row with `action = Delete`, `entityType = kubo`,
  `entityId = kubo_id`.

---

## 11. Known contract quirks

- Requests accept camelCase and snake_case aliases; responses are always
  snake_case.
- The response schema in TypeScript uses camelCase (`kuboId`, `typeName`), but the
  wire format is snake_case.
- `price_per_night` is a JSON string.
- Creation accepts all status enum values at validation time but only
  `Available`, `Maintenance`, and `OutOfService` are accepted by the database.
- `PATCH /kubos/:kuboId` silently ignores a `status` field.
- Same-status changes return `200` without an audit row.
- `GET /kubos/type/:kuboTypeId` paginates but omits `count`.
- `GET /kubos/available` is unpaginated and omits `count`.
- `GET /kubos/available` requires `checkIn` and `checkOut`; date-time inputs are
  truncated to date-only.
- `PATCH` accepts `{}` at the Zod layer but the database rejects it with `400`.
- `count` on `GET /kubos` is page size, not total.
- `DELETE` returns `204` but the controller calls `res.status(204).json()`; clients
  must treat it as an empty `204`.
