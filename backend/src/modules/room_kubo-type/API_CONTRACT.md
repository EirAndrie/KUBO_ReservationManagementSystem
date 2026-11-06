# Kubo Type Module — API Contract

Kubo type (accommodation category) endpoints for the Kubo Reservation Management
System.

- **Base path:** `/KUBO_Resort/Management-System/v0.0.1`
- **Module mount:** `/kubo-types`
- **Source files:** `kubo-type.routes.ts`, `kubo-type.controllers.ts`, `kubo-type.services.ts`, `repository/kubo-type.schema.ts`, `repository/kubo-type.repository.ts`
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
| `GET /kubo-types`, `GET /kubo-types/:kuboTypeId` | Any authenticated employee |
| `POST`, `PATCH`, `DELETE` | `Administrator` (stored `role_name` equals `administrator`, exact) |

The authenticated employee must have status `Active`; otherwise the authentication
middleware returns `403 Account is not active`.

### 1.3 Pagination

List endpoints accept:

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |

Pagination is performed in the database. `count` is the number of rows returned
for the current page, not the total number of matching kubo types.

### 1.4 Success envelope

Every successful response includes:

```json
{
  "success": true,
  "message": "Human-readable result"
}
```

Kubo type payloads are placed under the key **`kuboTypes`**. On list responses it
is an array; on create/get/update it is a single object. There is no `data`
wrapper.

### 1.5 Kubo type object

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `kubo_type_id` | string (UUID) | No | Primary key |
| `type_name` | string | No | Case-insensitively unique |
| `capacity` | integer | No | Greater than zero |
| `price_per_night` | string (decimal) | No | PostgreSQL `numeric` is serialized as a JSON string, e.g. `"1500.00"` |
| `description` | string | Yes | `NULL` when not supplied or explicitly cleared |

### 1.6 Error envelope

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

### 1.7 Request field aliases

Create and update bodies accept **either** camelCase fields or the snake_case
column-style aliases below. The response always uses snake_case.

| Contract field | Accepted aliases |
|---|---|
| `kuboTypeName` | `type_name`, `kubo_type_name` |
| `kuboTypeCapacity` | `kubo_type_capacity`, `capacity` |
| `pricePerNight` | `price_per_night` |
| `kuboTypeDescription` | `kubo_type_description`, `description` |

### 1.8 Validation behavior

Request bodies are validated with Zod before the controller runs. Validation
failures return `400` with all issues joined into one `message`. Unknown body
fields are stripped by Zod.

Numeric constraints:

- `kuboTypeCapacity` must be a positive integer.
- `pricePerNight` must be a finite, non-negative number with at most 2 decimal
  places.

### 1.9 Path parameter validation

`kuboTypeId` must be a UUID matching the shared UUID pattern (versions 1–5).
Invalid values return `400 Invalid kuboTypeId format`.

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

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/kubo-types` | Administrator | Create a kubo type |
| `GET` | `/kubo-types` | Authenticated | List/search kubo types |
| `GET` | `/kubo-types/:kuboTypeId` | Authenticated | Get one kubo type |
| `PATCH` | `/kubo-types/:kuboTypeId` | Administrator | Update a kubo type |
| `DELETE` | `/kubo-types/:kuboTypeId` | Administrator | Delete an unused kubo type |

---

## 3. `POST /kubo-types`

Create a kubo type.

### 3.1 Access

Administrator only.

### 3.2 Request body

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `kuboTypeName` | string | Yes | Trimmed; 1–100 characters |
| `kuboTypeCapacity` | integer | Yes | Greater than zero |
| `pricePerNight` | number | Yes | Non-negative; at most 2 decimal places |
| `kuboTypeDescription` | string | No | Trimmed; maximum 255 characters |

```json
{
  "kuboTypeName": "Family Kubo",
  "kuboTypeCapacity": 4,
  "pricePerNight": 2500.0,
  "kuboTypeDescription": "Two-bedroom kubo for families"
}
```

### 3.3 Success response — `201 Created`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Kubo type created successfully` |
| `kuboTypes` | object | No | Created kubo type |

```json
{
  "success": true,
  "message": "Kubo type created successfully",
  "kuboTypes": {
    "kubo_type_id": "d1e2f3a4-b5c6-4789-8abc-def012345678",
    "type_name": "Family Kubo",
    "capacity": 4,
    "price_per_night": "2500.00",
    "description": "Two-bedroom kubo for families"
  }
}
```

### 3.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Body fails validation | `400` | Validation detail |
| Name blank or over 100 characters | `400` | `Kubo type name must be between 1 and 100 characters.` |
| Capacity zero or negative | `400` | `Capacity must be greater than zero.` |
| Negative price | `400` | `Price per night cannot be negative.` |
| More than 2 decimal places | `400` | `Price per night cannot have more than two decimal places.` |
| Description over 255 characters | `400` | `Kubo type description cannot exceed 255 characters.` |
| Name already exists (case-insensitive) | `400` | `Kubo type name already exists.` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Names are trimmed and checked case-insensitively for uniqueness.
- Description is trimmed; blank or omitted becomes `NULL`.
- The insert and audit row are written in one transaction.
- The nightly rate is stored on the kubo type; changing it later does not change
  prices already snapshotted on reservations.

### 3.5 Side effects

- Inserts one `kubo.kubo_type` row.
- Inserts one `kubo.audit_log` row with `action = Create`,
  `entityType = kubo_type`, `entityId = kubo_type_id`.

---

## 4. `GET /kubo-types`

List or search kubo types.

### 4.1 Access

Any authenticated employee.

### 4.2 Query parameters

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |
| `search` | string | — | Trimmed; 1–100 characters; matches `type_name` or `description` |
| `minCapacity` | integer | — | Non-negative |
| `maxCapacity` | integer | — | Non-negative; must be ≥ `minCapacity` when both are supplied |

Empty-string numeric or search values are treated as not supplied.

### 4.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `count` | integer | No | Number of rows on this page |
| `message` | string | No | `Successfully listed kubo types` |
| `kuboTypes` | array | No | Ordered by `type_name`, `kubo_type_id` |

```json
{
  "success": true,
  "count": 1,
  "message": "Successfully listed kubo types",
  "kuboTypes": [
    {
      "kubo_type_id": "d1e2f3a4-b5c6-4789-8abc-def012345678",
      "type_name": "Family Kubo",
      "capacity": 4,
      "price_per_night": "2500.00",
      "description": "Two-bedroom kubo for families"
    }
  ]
}
```

### 4.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid pagination or filter values | `400` | Validation detail |
| Negative minimum capacity | `400` | `Minimum capacity cannot be negative.` |
| Negative maximum capacity | `400` | `Maximum capacity cannot be negative.` |
| Minimum capacity exceeds maximum | `400` | `Minimum capacity cannot exceed maximum capacity.` |
| Not authenticated | `401` | `Authentication required` |
| Unexpected database failure | `500` | `Failed to search kubo types in database` |

Behavior notes:

- No rows returns `200` with an empty array and `count: 0`.
- `count` is the page size, not total matches.
- Search is case-insensitive and also matches the description.

### 4.5 Side effects

None.

---

## 5. `GET /kubo-types/:kuboTypeId`

Get one kubo type by UUID.

### 5.1 Access

Any authenticated employee.

### 5.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `kuboTypeId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 5.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully fetched kubo type by its ID` |
| `kuboTypes` | object | No | Requested kubo type |

### 5.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid kuboTypeId format` |
| Kubo type does not exist | `404` | `Kubo type not found` |
| Not authenticated | `401` | `Authentication required` |

### 5.5 Side effects

None.

---

## 6. `PATCH /kubo-types/:kuboTypeId`

Update a kubo type.

### 6.1 Access

Administrator only.

### 6.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `kuboTypeId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 6.3 Request body

All fields are optional, but **at least one** must be supplied.

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `kuboTypeName` | string | No | Trimmed; 1–100 characters |
| `kuboTypeCapacity` | integer | No | Greater than zero |
| `pricePerNight` | number | No | Non-negative; at most 2 decimal places |
| `kuboTypeDescription` | string | No | Trimmed; maximum 255 characters |

```json
{
  "pricePerNight": 2750.0,
  "kuboTypeDescription": "Two-bedroom kubo with breakfast"
}
```

### 6.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully updated kubo type` |
| `kuboTypes` | object | No | Updated kubo type |

### 6.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid kuboTypeId format` |
| Body fails Zod validation | `400` | Validation detail |
| Empty body | `400` | `Provide at least one field to update.` |
| Name blank or over 100 characters | `400` | `Kubo type name must be between 1 and 100 characters.` |
| Capacity zero or negative | `400` | `Capacity must be greater than zero.` |
| Negative price | `400` | `Price per night cannot be negative.` |
| More than 2 decimal places | `400` | `Price per night cannot have more than two decimal places.` |
| Description over 255 characters | `400` | `Kubo type description cannot exceed 255 characters.` |
| Name already exists (case-insensitive) | `400` | `Kubo type name already exists.` |
| Kubo type does not exist | `404` | `Kubo type not found` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Passing `kuboTypeDescription: ""` clears the description to `NULL`. Omitting the
  field leaves the existing description unchanged.
- Names remain case-insensitively unique.
- Updates and the audit row are written in one transaction.

### 6.6 Side effects

- Updates one `kubo.kubo_type` row.
- Inserts one `kubo.audit_log` row with `action = Update`,
  `entityType = kubo_type`, `entityId = kubo_type_id`, including old/new snapshots.

---

## 7. `DELETE /kubo-types/:kuboTypeId`

Delete a kubo type that is not referenced by any kubo.

### 7.1 Access

Administrator only.

### 7.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `kuboTypeId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 7.3 Request body

None.

### 7.4 Success response — `204 No Content`

No response body.

### 7.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid kuboTypeId format` |
| Kubo type does not exist | `404` | `Kubo type not found` |
| Referenced by at least one kubo | `409` | `Kubo type is referenced by kubos. Set those kubos OutOfService instead of deleting the type.` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Kubo types cannot be deactivated; the only configuration change is deletion.
- If any kubo references the type, deletion is blocked. Move or retire those kubos
  first.
- The service checks existence before the database routine and also checks the
  boolean result afterward.
- The delete audit row is written before the type row is removed.

### 7.6 Side effects

- Deletes one `kubo.kubo_type` row.
- Inserts one `kubo.audit_log` row with `action = Delete`,
  `entityType = kubo_type`, `entityId = kubo_type_id`.

---

## 8. Known contract quirks

- Requests accept camelCase **and** snake_case aliases; responses are always
  snake_case.
- The response field is `type_name`, not `kuboTypeName`.
- `price_per_night` is a JSON **string** because PostgreSQL `numeric` is serialized
  as text by the driver.
- `PATCH` accepts `{}` at the Zod layer but the database rejects it with `400`.
- An empty string description clears the description; an omitted description leaves
  it unchanged.
- `count` is the returned page size, not a total.
- `DELETE` returns `204` but the controller calls `res.status(204).json()`; clients
  must treat it as an empty `204`.
