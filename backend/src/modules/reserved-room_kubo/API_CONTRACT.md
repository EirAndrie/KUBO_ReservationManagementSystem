# Reserved Kubo Module — API Contract

Kubo assignment and check-in/check-out endpoints for the Kubo Reservation
Management System.

- **Base path:** `/KUBO_Resort/Management-System/v0.0.1`
- **Module mount:** `/reservations/:reservationId/kubos`
- **Source files:** `reserved-room_kubo.routes.ts`, `reserved-room_kubo.controllers.ts`, `reserved-room_kubo.services.ts`, `repository/reserved-kubo.schema.ts`, `repository/reserved-kubo.repository.ts`
- **Authentication:** All endpoints require a Bearer access token.
- **Authorization:** Reads are open to any authenticated employee. Mutations require **Staff**.

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
| `GET` endpoints | Any authenticated employee |
| `POST`, `PATCH`, `DELETE` | `Staff` (stored `role_name` equals `Staff`, case-insensitive) |

The authenticated employee must have status `Active`; otherwise the authentication
middleware returns `403 Account is not active`.

### 1.3 Pagination

Not supported. Every endpoint returns all matching assignments.

### 1.4 Success envelope

Every successful response includes:

```json
{
  "success": true,
  "message": "Human-readable result"
}
```

Assignment payloads are placed under the key **`reservedKubos`** (camelCase key).
On list responses it is an array; on single operations it is an object. There is no
`data` wrapper and no `count` field.

### 1.5 Assignment object

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `reservation_id` | string (UUID) | No | |
| `kubo_id` | string (UUID) | No | |
| `kubo_number` | string | No | |
| `kubo_type_id` | string (UUID) | No | |
| `type_name` | string | No | |
| `check_in_date` | string (`YYYY-MM-DD`) | No | |
| `check_out_date` | string (`YYYY-MM-DD`) | No | |
| `scheduled_check_in_time` | string (`HH:MM:SS`) | Yes | |
| `scheduled_check_out_time` | string (`HH:MM:SS`) | Yes | |
| `actual_check_in_datetime` | string (ISO 8601) | Yes | |
| `actual_check_out_datetime` | string (ISO 8601) | Yes | |
| `early_check_in_approved` | boolean | No | |
| `price_at_booking` | string (decimal) | No | PostgreSQL `numeric` serialized as a JSON string |
| `status` | string | No | See §1.6 |
| `nights` | integer | No | `check_out_date − check_in_date` |
| `amount` | string (decimal) | No | `nights × price_at_booking` |

### 1.6 Assignment status values

`Reserved`, `CheckedIn`, `CheckedOut`, `Cancelled`, `NoShow`.

Lifecycle:

| From | Allowed to | Trigger |
|---|---|---|
| `Reserved` | `CheckedIn` | Check-in endpoint |
| `Reserved` | `Cancelled` | Reservation cancellation |
| `Reserved` | `NoShow` | Reservation no-show |
| `CheckedIn` | `CheckedOut` | Check-out endpoint |
| `CheckedOut` | Terminal | — |
| `Cancelled` | Terminal | — |
| `NoShow` | Terminal | — |

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
| `kuboId` | `kubo_id` |
| `checkInDate` | `check_in_date` |
| `checkOutDate` | `check_out_date` |
| `scheduledCheckInTime` | `scheduled_check_in_time` |
| `scheduledCheckOutTime` | `scheduled_check_out_time` |

The response always uses snake_case fields under the `reservedKubos` key.

### 1.9 Validation behavior

Request bodies are validated with Zod before the controller runs. Validation
failures return `400` with all issues joined into one `message`. Unknown body
fields are stripped by Zod.

Dates accept ISO date or date-time strings and are converted to `YYYY-MM-DD`.

Times must use `HH:MM` or `HH:MM:SS` (24-hour).

### 1.10 Path parameter validation

`reservationId` and `kuboId` must be UUIDs matching the shared UUID pattern
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
| `POST` | `/reservations/:reservationId/kubos` | Staff | Assign a kubo |
| `GET` | `/reservations/:reservationId/kubos` | Authenticated | List assignments |
| `GET` | `/reservations/:reservationId/kubos/:kuboId` | Authenticated | Get one assignment |
| `PATCH` | `/reservations/:reservationId/kubos/:kuboId` | Staff | Update dates or scheduled times |
| `DELETE` | `/reservations/:reservationId/kubos/:kuboId` | Staff | Remove an assignment |
| `PATCH` | `/reservations/:reservationId/kubos/:kuboId/check-in` | Staff | Record check-in |
| `PATCH` | `/reservations/:reservationId/kubos/:kuboId/check-out` | Staff | Record check-out |
| `PATCH` | `/reservations/:reservationId/kubos/:kuboId/early-check-in` | Staff | Approve early check-in |

---

## 3. `POST /reservations/:reservationId/kubos`

Assign a kubo to a pending or confirmed reservation.

### 3.1 Access

Staff only.

### 3.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 3.3 Request body

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `kuboId` | string (UUID) | Yes | Must reference an existing kubo |
| `checkInDate` | date | Yes | Cannot be in the past |
| `checkOutDate` | date | Yes | Must be later than check-in |
| `scheduledCheckInTime` | string | No | `HH:MM` or `HH:MM:SS` |
| `scheduledCheckOutTime` | string | No | Must be later than scheduled check-in when both are supplied |

```json
{
  "kuboId": "e1f2a3b4-c5d6-4789-8abc-def012345678",
  "checkInDate": "2026-11-15",
  "checkOutDate": "2026-11-17"
}
```

### 3.4 Success response — `201 Created`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully assigned a Kubo to Reservation` |
| `reservedKubos` | object | No | Created assignment |

### 3.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID/body | `400` | Validation detail |
| Reservation does not exist | `404` | `Reservation does not exist.` |
| Reservation is not `Pending` or `Confirmed` | `400` | `Only Pending or Confirmed reservations can be modified.` |
| Scheduled check-out not later than scheduled check-in | `400` | `Scheduled check-out time must be later than scheduled check-in time.` |
| Check-out not later than check-in | `400` | `Check-out must be later than check-in.` |
| Check-in date in the past | `400` | `Check-in date cannot be in the past.` |
| Kubo does not exist | `404` | `Kubo does not exist.` |
| Kubo status is not bookable | `400` | `Kubo is not available for booking.` |
| Same-day check-in on a `Cleaning` kubo | `400` | `Kubo is being cleaned and is not available for a same-day check-in.` |
| Overlapping assignment | `400` | `Kubo is not available for the selected dates.` |
| Assignment cannot be reloaded after insert | `404` | `Reserved kubo not found` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- The kubo type’s current `price_per_night` is snapshotted into
  `price_at_booking`.
- The new assignment starts as `Reserved`.
- A kubo in `Available` status becomes `Reserved`; other statuses are left alone.
- Overlap validation excludes the current reservation’s own assignments.
- The insert, kubo status update, and audit row are written in one transaction.

### 3.6 Side effects

- Inserts one `kubo.reserved_kubo` row.
- May update `kubo.kubo.status` to `Reserved`.
- Inserts one `kubo.audit_log` row with `action = Create`,
  `entityType = reservation`, `entityId = reservation_id`.

---

## 4. `GET /reservations/:reservationId/kubos`

List all assignments for a reservation.

### 4.1 Access

Any authenticated employee.

### 4.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 4.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully fetched reserved kubos` |
| `reservedKubos` | array | No | Ordered by `check_in_date`, `kubo_number` |

```json
{
  "success": true,
  "message": "Successfully fetched reserved kubos",
  "reservedKubos": [
    {
      "reservation_id": "5be2d27d-a10e-440a-acab-95b8020bfecf",
      "kubo_id": "e1f2a3b4-c5d6-4789-8abc-def012345678",
      "kubo_number": "K-101",
      "kubo_type_id": "d1e2f3a4-b5c6-4789-8abc-def012345678",
      "type_name": "Family Kubo",
      "check_in_date": "2026-11-15",
      "check_out_date": "2026-11-17",
      "scheduled_check_in_time": null,
      "scheduled_check_out_time": null,
      "actual_check_in_datetime": null,
      "actual_check_out_datetime": null,
      "early_check_in_approved": false,
      "price_at_booking": "2500.00",
      "status": "Reserved",
      "nights": 2,
      "amount": "5000.00"
    }
  ]
}
```

### 4.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid reservationId format` |
| Not authenticated | `401` | `Authentication required` |
| Unexpected database failure | `500` | `Failed to fetch reserved kubos` |

Behavior notes:

- No assignments returns `200` with an empty array.
- There is no `count` and no pagination.
- All assignment statuses are returned, including `Cancelled` and `NoShow`.

### 4.5 Side effects

None.

---

## 5. `GET /reservations/:reservationId/kubos/:kuboId`

Get one assignment by reservation and kubo UUID.

### 5.1 Access

Any authenticated employee.

### 5.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |
| `kuboId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 5.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully fetched reserved kubo` |
| `reservedKubos` | object | No | Assignment row |

### 5.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid reservationId format` / `Invalid kuboId format` |
| Assignment does not exist | `404` | `Reserved kubo not found` |
| Not authenticated | `401` | `Authentication required` |

### 5.5 Side effects

None.

---

## 6. `PATCH /reservations/:reservationId/kubos/:kuboId`

Update assignment dates or scheduled times.

### 6.1 Access

Staff only.

### 6.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |
| `kuboId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 6.3 Request body

At least one field is required.

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `checkInDate` | date | No | Cannot be in the past |
| `checkOutDate` | date | No | Must be later than check-in |
| `scheduledCheckInTime` | string | No | `HH:MM` or `HH:MM:SS` |
| `scheduledCheckOutTime` | string | No | Must be later than scheduled check-in when both are supplied |

```json
{
  "checkInDate": "2026-11-16",
  "checkOutDate": "2026-11-18"
}
```

### 6.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully updated reserved kubo` |
| `reservedKubos` | object | No | Updated assignment |

### 6.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID/body | `400` | Validation detail |
| Empty body | `400` | `Provide at least one assignment field to update.` |
| Reservation does not exist | `404` | `Reservation does not exist.` |
| Assignment does not exist | `404` | `Reserved kubo not found` |
| Reservation is not `Pending` or `Confirmed` | `400` | `Only Pending or Confirmed reservations can be modified.` |
| Assignment is not `Reserved` | `400` | `Only Reserved assignments can be modified.` |
| Check-out not later than check-in | `400` | `Check-out must be later than check-in.` |
| Check-in date in the past | `400` | `Check-in date cannot be in the past.` |
| Scheduled times invalid | `400` | `Scheduled check-out time must be later than scheduled check-in time.` |
| Kubo no longer available for the new dates | `400` | `Kubo is not available for the selected dates.` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Changing either date re-runs availability validation and **re-snapshots**
  `price_at_booking` at the kubo type’s current rate.
- Changing only scheduled times keeps the existing `price_at_booking`.
- Scheduled times cannot be cleared: omitting them leaves the current values.
- Only `Reserved` assignments can be modified.
- The update and audit row are written in one transaction.

### 6.6 Side effects

- Updates one `kubo.reserved_kubo` row.
- May change `price_at_booking` when dates change.
- Inserts one `kubo.audit_log` row with `action = Update`,
  `entityType = reservation`, `entityId = reservation_id`.

---

## 7. `DELETE /reservations/:reservationId/kubos/:kuboId`

Remove an assignment from a pending or confirmed reservation.

### 7.1 Access

Staff only.

### 7.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |
| `kuboId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 7.3 Request body

None.

### 7.4 Success response — `204 No Content`

No response body.

### 7.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid reservationId format` / `Invalid kuboId format` |
| Reservation does not exist | `404` | `Reservation does not exist.` |
| Assignment does not exist | `404` | `Reserved kubo not found` |
| Reservation is not `Pending` or `Confirmed` | `400` | `Only Pending or Confirmed reservations can be modified.` |
| Assignment is not `Reserved` | `400` | `Only Reserved assignments can be removed.` |
| Removing the last assignment | `400` | `A reservation must retain at least one kubo assignment.` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- The service checks the assignment exists before calling the database routine
  and also checks the boolean result afterward.
- A reservation must always retain at least one assignment.
- The kubo is released to `Available` when no other active assignment needs it.

### 7.6 Side effects

- Deletes one `kubo.reserved_kubo` row.
- May update `kubo.kubo.status` to `Available`.
- Inserts one `kubo.audit_log` row with `action = Delete`,
  `entityType = reservation`, `entityId = reservation_id`.

---

## 8. `PATCH /reservations/:reservationId/kubos/:kuboId/check-in`

Record check-in for one assignment.

### 8.1 Access

Staff only.

### 8.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |
| `kuboId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 8.3 Request body

None.

### 8.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully checked in reserved kubo` |
| `reservedKubos` | object | No | Assignment with status `CheckedIn` |

### 8.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | Validation detail |
| Reservation does not exist | `404` | `Reservation does not exist.` |
| Assignment does not exist | `404` | `Reserved kubo not found` |
| Reservation is not `Confirmed` or `CheckedIn` | `400` | `Check-in requires a Confirmed or CheckedIn reservation.` |
| Assignment is not `Reserved` | `400` | `Only Reserved assignments can be checked in.` |
| Check-in before the scheduled date without approval | `400` | `Early check-in requires explicit approval.` |
| Current date is on/after check-out date | `400` | `Check-in must occur before the check-out date.` |
| Kubo status is not `Available` or `Reserved` | `400` | `Kubo is not ready for check-in. Current status: <status>.` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Check-in behavior:

- Sets assignment status to `CheckedIn` and `actual_check_in_datetime` to now.
- Sets the kubo status to `Occupied`.
- If the reservation was `Confirmed`, sets it to `CheckedIn`.
- Early check-in is allowed only when `early_check_in_approved` is already true.
- Multiple assignments can be checked in independently.

### 8.6 Side effects

- Updates `kubo.reserved_kubo` and `kubo.kubo`.
- May update `kubo.reservation.status` to `CheckedIn`.
- Inserts one `kubo.audit_log` row with `action = Update`,
  `entityType = reservation`, `entityId = reservation_id`.

---

## 9. `PATCH /reservations/:reservationId/kubos/:kuboId/check-out`

Record check-out for one assignment.

### 9.1 Access

Staff only.

### 9.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |
| `kuboId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 9.3 Request body

None.

### 9.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully checked out reserved kubo` |
| `reservedKubos` | object | No | Assignment with status `CheckedOut` |

### 9.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | Validation detail |
| Reservation does not exist | `404` | `Reservation does not exist.` |
| Assignment does not exist | `404` | `Reserved kubo not found` |
| Reservation is not `CheckedIn` | `400` | `Check-out requires a CheckedIn reservation.` |
| Assignment is not `CheckedIn` | `400` | `Only CheckedIn assignments can be checked out.` |
| Outstanding balance is not zero | `400` | `Outstanding balance must be zero before check-out. Current balance: <amount>.` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Check-out behavior:

- The whole reservation’s `outstanding_balance` must be exactly `0`.
  This includes accommodation, additional charges, completed payments, and
  completed refunds.
- Sets assignment status to `CheckedOut` and `actual_check_out_datetime` to now.
- Sets the kubo status to `Cleaning`.
- If no assignments remain in an active status (`Reserved`, `CheckedIn`), sets the
  reservation status to `CheckedOut`.
- Multiple assignments can be checked out independently.

### 9.6 Side effects

- Updates `kubo.reserved_kubo` and `kubo.kubo`.
- May update `kubo.reservation.status` to `CheckedOut`.
- Inserts one `kubo.audit_log` row with `action = Update`,
  `entityType = reservation`, `entityId = reservation_id`.

---

## 10. `PATCH /reservations/:reservationId/kubos/:kuboId/early-check-in`

Approve early check-in for a reserved assignment.

### 10.1 Access

Staff only.

### 10.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |
| `kuboId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 10.3 Request body

None.

### 10.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully approved early check-in` |
| `reservedKubos` | object | No | Assignment with `early_check_in_approved: true` |

### 10.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | Validation detail |
| Reservation does not exist | `404` | `Reservation does not exist.` |
| Assignment does not exist | `404` | `Reserved kubo not found` |
| Reservation is not `Confirmed` or `CheckedIn` | `400` | `Only Confirmed or CheckedIn reservations can approve early check-in.` |
| Assignment is not `Reserved` | `400` | `Only Reserved assignments can approve early check-in.` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- This endpoint only sets `early_check_in_approved = true`. It does **not** check in
  the assignment; call the check-in endpoint afterward.
- It does not verify that the current date is actually before the scheduled check-in
  date.
- Calling it again on an already-approved assignment returns success.

### 10.6 Side effects

- Updates `kubo.reserved_kubo.early_check_in_approved`.
- Inserts one `kubo.audit_log` row with `action = Update`,
  `entityType = reservation`, `entityId = reservation_id`.

---

## 11. Known contract quirks

- The response key is camelCase **`reservedKubos`**, while the nested assignment
  fields are snake_case.
- `price_at_booking` and `amount` are JSON strings in this module but JSON numbers
  when the same assignment is embedded in a reservation response.
- There is no pagination and no `count` on any endpoint.
- Editing assignment dates **re-prices** `price_at_booking` at the current kubo-type
  rate, even though new reservations snapshot the rate at booking time.
- Scheduled times cannot be cleared through this API.
- Scheduled times are compared as clock times, not date-times. A `14:00`
  check-in with a `12:00` next-day check-out is rejected when both are supplied.
- The early-check-in endpoint is a flag toggle, not a check-in operation.
- Check-out is blocked until the entire reservation balance is exactly zero.
- `DELETE` returns `204` but the controller calls `res.status(204).json()`; clients
  must treat it as an empty `204`.
- Assignment changes are only allowed while the reservation is `Pending` or
  `Confirmed`, and the assignment is `Reserved`.
