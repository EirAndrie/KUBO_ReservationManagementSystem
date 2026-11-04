# Guest Module — API Contract

Guest profile endpoints for the Kubo Reservation Management System.

- **Base path:** `/KUBO_Resort/Management-System/v0.0.1`
- **Module mount:** `/guests`
- **Source files:** `guest.routes.ts`, `guest.controllers.ts`, `guest.services.ts`, `repository/guest.schema.ts`, `repository/guest.repository.ts`
- **Authentication:** All endpoints require a Bearer access token.
- **Authorization:** Reads are open to any authenticated employee. Create/update require **Staff**. Delete requires **Administrator**.

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
| `GET /guests`, `GET /guests/:guestId` | Any authenticated employee |
| `POST /guests`, `PATCH /guests/:guestId` | `Staff` (stored `role_name` equals `Staff`, case-insensitive) |
| `DELETE /guests/:guestId` | `Administrator` (`Admin` or `Administrator`, case-insensitive) |

The authenticated employee must have status `Active`; otherwise the authentication
middleware returns `403 Account is not active`.

### 1.3 Pagination

List endpoints accept:

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |

Pagination is performed in the database. `count` is the number of rows returned
for the current page, not the total number of matching guests.

### 1.4 Success envelope

Every successful response includes:

```json
{
  "success": true,
  "message": "Human-readable result"
}
```

Guest payloads are placed under the key **`guests`**. On list responses it is an
array; on create/get/update it is a single object. Create responses additionally
include `reused`. There is no `data` wrapper.

### 1.5 Guest object

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `guest_id` | string (UUID) | No | Primary key |
| `first_name` | string | No | |
| `last_name` | string | No | |
| `email` | string | No | Stored lowercase |
| `phone` | string | No | `09XXXXXXXXX` or `+639XXXXXXXXX` |
| `address_line_1` | string | Yes | |
| `city` | string | Yes | |
| `state_province` | string | Yes | |
| `zip_postal_code` | string | Yes | |
| `country` | string | Yes | |
| `valid_id_type` | string | No | See §1.6 |
| `id_number` | string | No | Returned unmasked; masked only in audit rows |
| `created_at` | string (ISO 8601) | No | |
| `updated_at` | string (ISO 8601) | No | |

### 1.6 Valid ID types

`Passport`, `DriverLicense`, `NationalID`, `PhilHealthID`, `SSSID`, `UMID`,
`PostalID`, `PRCID`, `VotersID`, `SeniorCitizenID`, `StudentID`, `Other`.

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

Phone validation:

- Accepted: `09` followed by 9 digits, or `+639` followed by 9 digits.
- Rejected: spaces, dashes, parentheses, and other country codes.

Email validation uses Zod’s email check plus a 100-character maximum.
The database additionally lowercases the stored email.

### 1.9 Path parameter validation

`guestId` must be a UUID matching the shared UUID pattern (versions 1–5). Invalid
values return `400 Invalid guestId format`.

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
| `POST` | `/guests` | Staff | Create a guest or reuse an existing one |
| `GET` | `/guests` | Authenticated | List/search guests |
| `GET` | `/guests/:guestId` | Authenticated | Get one guest |
| `PATCH` | `/guests/:guestId` | Staff | Update a guest profile |
| `DELETE` | `/guests/:guestId` | Administrator | Delete an unused guest |

---

## 3. `POST /guests`

Create a guest. If a guest already matches the supplied email, or the supplied ID
type/number pair, the existing guest is returned instead of creating a duplicate.

### 3.1 Access

Staff only.

### 3.2 Request body

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `firstName` | string | Yes | Trimmed; 1–100 characters |
| `lastName` | string | Yes | Trimmed; 1–100 characters |
| `email` | string | Yes | Valid email; maximum 100 characters |
| `phone` | string | Yes | `09XXXXXXXXX` or `+639XXXXXXXXX` |
| `addressLine1` | string | No | Trimmed; maximum 200 characters |
| `city` | string | No | Trimmed; maximum 100 characters |
| `stateProvince` | string | No | Trimmed; maximum 100 characters |
| `zipPostalCode` | string | No | Trimmed; maximum 20 characters |
| `country` | string | No | Trimmed; maximum 100 characters |
| `validIdType` | string | Yes | One of the values in §1.6 |
| `idNumber` | string | Yes | Trimmed; 1–50 characters |

```json
{
  "firstName": "Juan",
  "lastName": "Dela Cruz",
  "email": "juan.delacruz@example.com",
  "phone": "09171234567",
  "addressLine1": "12 Mabini Street",
  "city": "Quezon City",
  "stateProvince": "Metro Manila",
  "zipPostalCode": "1100",
  "country": "Philippines",
  "validIdType": "Passport",
  "idNumber": "P1234567A"
}
```

### 3.3 Success response — `201 Created` or `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Guest created successfully` or `Existing guest reused` |
| `reused` | boolean | No | `false` for a new guest, `true` for reuse |
| `guests` | object | No | Guest row |

**New guest — `201 Created`:**

```json
{
  "success": true,
  "message": "Guest created successfully",
  "reused": false,
  "guests": {
    "guest_id": "c1d2e3f4-a5b6-4789-8abc-def012345678",
    "first_name": "Juan",
    "last_name": "Dela Cruz",
    "email": "juan.delacruz@example.com",
    "phone": "09171234567",
    "address_line_1": "12 Mabini Street",
    "city": "Quezon City",
    "state_province": "Metro Manila",
    "zip_postal_code": "1100",
    "country": "Philippines",
    "valid_id_type": "Passport",
    "id_number": "P1234567A",
    "created_at": "2026-11-04T08:30:00.000Z",
    "updated_at": "2026-11-04T08:30:00.000Z"
  }
}
```

**Existing guest reused — `200 OK`:**

```json
{
  "success": true,
  "message": "Existing guest reused",
  "reused": true,
  "guests": {
    "guest_id": "c1d2e3f4-a5b6-4789-8abc-def012345678",
    "first_name": "Juan",
    "last_name": "Dela Cruz",
    "email": "juan.delacruz@example.com",
    "phone": "09171234567",
    "address_line_1": "12 Mabini Street",
    "city": "Quezon City",
    "state_province": "Metro Manila",
    "zip_postal_code": "1100",
    "country": "Philippines",
    "valid_id_type": "Passport",
    "id_number": "P1234567A",
    "created_at": "2026-11-04T08:30:00.000Z",
    "updated_at": "2026-11-04T08:30:00.000Z"
  }
}
```

### 3.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Body fails validation | `400` | Validation detail |
| Invalid email format | `400` | `Invalid email format: <email>` |
| Invalid phone format | `400` | `Phone must use 09XXXXXXXXX or +639XXXXXXXXX format.` |
| Duplicate row created during a race with no matching existing guest | `400` | `Guest already exists.` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Reuse behavior:

- The service checks for an existing guest by **email first**, then by
  **ID type + ID number** (case-insensitive ID number).
- If either matches, the existing record is returned unchanged with `200` and
  `reused: true`.
- Reuse does **not** update the existing profile, does **not** overwrite fields with
  the new request values, and does **not** write an audit row.
- The database routine repeats the same reuse lookup defensively.
- Email is trimmed and lowercased before storage.
- Optional address fields are trimmed and stored as `NULL` when blank.

### 3.5 Side effects

- New guest: inserts one `kubo.guest` row and one audit row
  (`action = Create`, `entityType = guest`, `entityId = guest_id`).
- Reused guest: no database writes and no audit row.

---

## 4. `GET /guests`

List or search guests.

### 4.1 Access

Any authenticated employee.

### 4.2 Query parameters

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |
| `search` | string | — | Trimmed; 1–100 characters |
| `validIdType` | string | — | One of the values in §1.6 |

`search` matches first name, last name, combined full name, email, or phone
(case-insensitive substring). `validIdType` filters by exact ID type.

### 4.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `count` | integer | No | Number of rows on this page |
| `message` | string | No | `Guests listed successfully` |
| `guests` | array | No | Guest rows ordered by `last_name`, `first_name`, `guest_id` |

```json
{
  "success": true,
  "count": 1,
  "message": "Guests listed successfully",
  "guests": [
    {
      "guest_id": "c1d2e3f4-a5b6-4789-8abc-def012345678",
      "first_name": "Juan",
      "last_name": "Dela Cruz",
      "email": "juan.delacruz@example.com",
      "phone": "09171234567",
      "address_line_1": "12 Mabini Street",
      "city": "Quezon City",
      "state_province": "Metro Manila",
      "zip_postal_code": "1100",
      "country": "Philippines",
      "valid_id_type": "Passport",
      "id_number": "P1234567A",
      "created_at": "2026-11-04T08:30:00.000Z",
      "updated_at": "2026-11-04T08:30:00.000Z"
    }
  ]
}
```

### 4.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid pagination or filter values | `400` | Validation detail |
| Not authenticated | `401` | `Authentication required` |
| Unexpected database failure | `500` | `Failed to search guests in database` |

Behavior notes:

- No rows returns `200` with an empty array and `count: 0`.
- `count` is the page size, not total matches.
- An empty query value such as `?search=` fails validation because an empty
  string is not accepted for `search` or `validIdType`.

### 4.5 Side effects

None.

---

## 5. `GET /guests/:guestId`

Get one guest by UUID.

### 5.1 Access

Any authenticated employee.

### 5.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `guestId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 5.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Guest fetched successfully by its ID` |
| `guests` | object | No | Guest row |

### 5.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid guestId format` |
| Guest does not exist | `404` | `Guest not found` |
| Not authenticated | `401` | `Authentication required` |

### 5.5 Side effects

None.

---

## 6. `PATCH /guests/:guestId`

Update a guest profile.

### 6.1 Access

Staff only.

### 6.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `guestId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 6.3 Request body

All fields are optional, but **at least one** must be supplied.

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `firstName` | string | No | Trimmed; 1–100 characters |
| `lastName` | string | No | Trimmed; 1–100 characters |
| `email` | string | No | Valid email; maximum 100 characters |
| `phone` | string | No | `09XXXXXXXXX` or `+639XXXXXXXXX` |
| `addressLine1` | string | No | Trimmed; maximum 200 characters |
| `city` | string | No | Trimmed; maximum 100 characters |
| `stateProvince` | string | No | Trimmed; maximum 100 characters |
| `zipPostalCode` | string | No | Trimmed; maximum 20 characters |
| `country` | string | No | Trimmed; maximum 100 characters |
| `validIdType` | string | No | One of the values in §1.6 |
| `idNumber` | string | No | Trimmed; 1–50 characters |

```json
{
  "phone": "09179876543",
  "city": "Makati City"
}
```

### 6.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Guest updated successfully` |
| `guests` | object | No | Updated guest row |

### 6.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid guestId format` |
| Body fails Zod validation | `400` | Validation detail |
| Empty body | `400` | `Provide at least one field to update.` |
| Blank required field | `400` | `First name...` / `Last name...` / `Email...` / `Phone...` / `ID number...` |
| Invalid email | `400` | `Invalid email format: <email>` |
| Invalid phone | `400` | `Phone must use 09XXXXXXXXX or +639XXXXXXXXX format.` |
| Email belongs to another guest | `400` | `A guest with email <email> already exists.` |
| ID type/number pair belongs to another guest | `400` | `A guest with the same ID type and ID number already exists.` |
| Unique constraint race | `400` | `A guest with the same email or ID details already exists.` |
| Guest does not exist | `404` | `Guest not found` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Updating email lowercases the stored value.
- Optional address fields use `COALESCE(NULLIF(trim(value), ''), current_value)`,
  so sending a blank string leaves the existing value unchanged; it does not clear
  the field.
- Email and ID uniqueness are checked against other guests before the update.
- All updates and the audit row are written in one transaction.

### 6.6 Side effects

- Updates one `kubo.guest` row.
- Inserts one `kubo.audit_log` row with `action = Update`, `entityType = guest`,
  `entityId = guest_id`, including masked `id_number` values in the snapshots.

---

## 7. `DELETE /guests/:guestId`

Delete a guest that has no reservations.

### 7.1 Access

Administrator only.

### 7.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `guestId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 7.3 Request body

None.

### 7.4 Success response — `204 No Content`

No response body.

### 7.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid guestId format` |
| Guest does not exist | `404` | `Guest not found` |
| Guest is referenced by a reservation | `409` | `Guest <guestId> cannot be deleted: referenced by reservations.` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- The service checks existence before delegating to the database routine.
- Any reservation reference blocks deletion. Guests with reservation history must be
  retained.
- The delete audit row is written before the row is removed.

### 7.6 Side effects

- Deletes one `kubo.guest` row.
- Inserts one `kubo.audit_log` row with `action = Delete`, `entityType = guest`,
  `entityId = guest_id`, including masked `id_number` values.

---

## 8. Known contract quirks

- `POST /guests` can return either `200` or `201`; clients must inspect
  `status`, `message`, and `reused`.
- Reuse returns the stored guest unchanged and writes no audit row.
- The `guests` key holds an object on create/get/update and an array on list.
- Responses use snake_case keys, while the TypeScript response DTO uses camelCase
  names.
- `id_number` is returned unmasked by the API but is masked (`****` plus last four
  characters) in audit snapshots.
- `PATCH` accepts `{}` at the Zod layer but the database rejects it with `400`.
- Blank optional address values do not clear existing data.
- Empty query strings for `search` or `validIdType` return `400`.
- `count` is the returned page size, not a total.
- `DELETE` returns `204` but the controller calls `res.status(204).json()`; clients
  must treat it as an empty `204`.
