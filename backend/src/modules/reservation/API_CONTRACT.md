# Reservation Module — API Contract

Reservation lifecycle endpoints for the Kubo Reservation Management System.

- **Base path:** `/KUBO_Resort/Management-System/v0.0.1`
- **Module mount:** `/reservations`
- **Source files:** `reservation.routes.ts`, `reservation.controllers.ts`, `reservation.services.ts`, `repository/reservation.schema.ts`, `repository/reservation.repository.ts`
- **Authentication:** All endpoints require a Bearer access token.
- **Authorization:** Reads are open to any authenticated employee. Mutations require **Staff**.
- **Related modules:** Kubo assignments and check-in/check-out live under `/reservations/:reservationId/kubos` (reserved-kubo module). Payments and charges have their own contracts.

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
| `GET /reservations`, `GET /reservations/:reservationId` | Any authenticated employee |
| `POST`, `PATCH`, `DELETE`, `/confirm`, `/cancel`, `/no-show` | `Staff` (stored `role_name` equals `Staff`, case-insensitive) |

The authenticated employee must have status `Active`; otherwise the authentication
middleware returns `403 Account is not active`. Administrators can read reservations
but cannot run reservation lifecycle mutations.

### 1.3 Pagination

List endpoints accept:

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |

Pagination is performed in the database. `count` is the number of rows returned
for the current page, not the total number of matching reservations.

### 1.4 Success envelope

Every successful response includes:

```json
{
  "success": true,
  "message": "Human-readable result"
}
```

Reservation payloads are placed under the key **`reservations`**. On list responses
it is an array; on create/get/update/confirm/cancel/no-show it is a single object.
There is no `data` wrapper.

### 1.5 Reservation object

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `reservation_id` | string (UUID) | No | Primary key |
| `reference_code` | string | No | `RES-YYYYMMDD-NNNN` |
| `guest_id` | string (UUID) | No | |
| `guest_name` | string | No | `first_name + ' ' + last_name` |
| `employee_id` | string (UUID) | No | Creating employee |
| `employee_name` | string | No | `first_name + ' ' + last_name` |
| `status` | string | No | See §1.6 |
| `booking_source` | string | No | See §1.7 |
| `cancelled_at` | string (ISO 8601) | Yes | `NULL` until cancellation |
| `cancellation_reason` | string | Yes | `NULL` until cancellation |
| `reserved_at` | string (ISO 8601) | No | Creation timestamp |
| `accommodation_total` | string (decimal) | No | Sum of `nights × price_at_booking` for non-cancelled/non-no-show assignments |
| `charges_total` | string (decimal) | No | **Grand total**: accommodation + additional charges |
| `net_paid` | string (decimal) | No | Completed payments minus completed refunds |
| `outstanding_balance` | string (decimal) | No | `charges_total − net_paid` |
| `assignments` | array | No | Assignment objects; empty array when none exist |

All top-level monetary fields are PostgreSQL `numeric` values serialized as JSON
strings, e.g. `"26800.00"`.

### 1.6 Reservation status values

`Pending`, `Confirmed`, `CheckedIn`, `CheckedOut`, `Cancelled`, `NoShow`.

Status transitions:

| From | Allowed to |
|---|---|
| `Pending` | `Confirmed`, `Cancelled` |
| `Confirmed` | `CheckedIn`, `Cancelled`, `NoShow` |
| `CheckedIn` | `CheckedOut` |
| `CheckedOut` | Terminal |
| `Cancelled` | Terminal |
| `NoShow` | Terminal |

This module performs `Pending → Confirmed`, `Pending/Confirmed → Cancelled`, and
`Confirmed → NoShow`. `Confirmed → CheckedIn` and `CheckedIn → CheckedOut` happen
through the reserved-kubo check-in/check-out endpoints.

### 1.7 Booking source values

`WalkIn`, `Online`, `Phone`, `Email`, `Facebook`, `TravelAgency`, `Referral`,
`Other`.

### 1.8 Assignment object (inside `assignments`)

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
| `price_at_booking` | number | No | Snapshot of nightly rate |
| `status` | string | No | `Reserved`, `CheckedIn`, `CheckedOut`, `Cancelled`, `NoShow` |
| `nights` | integer | No | `check_out_date − check_in_date` |
| `amount` | number | No | `nights × price_at_booking` |

Unlike top-level monetary strings, values inside the JSONB `assignments` array are
JSON numbers.

### 1.9 Derived totals

Reservation totals are never stored. Every read recomputes:

- `accommodation_total` — sum of `(check_out_date − check_in_date) × price_at_booking`
  for assignments whose status is not `Cancelled` or `NoShow`.
- `charges_total` — `accommodation_total` plus all additional-charge amounts.
- `net_paid` — sum of completed `Payment` transactions minus completed `Refund`
  transactions.
- `outstanding_balance` — `charges_total − net_paid`.

> **Naming quirk:** `charges_total` is the **grand total**, not the additional-charge
> subtotal.

### 1.10 Error envelope

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

### 1.11 Request field aliases

Create and update bodies accept these aliases:

| Contract field | Accepted aliases |
|---|---|
| `guestId` | `guest_id` |
| `bookingSource` | `booking_source` |
| `assignments[].kuboId` | `kubo_id` |
| `assignments[].checkInDate` | `check_in_date` |
| `assignments[].checkOutDate` | `check_out_date` |
| `assignments[].scheduledCheckInTime` | `scheduled_check_in_time` |
| `assignments[].scheduledCheckOutTime` | `scheduled_check_out_time` |

The response always uses snake_case.

### 1.12 Validation behavior

Request bodies are validated with Zod before the controller runs. Validation
failures return `400` with all issues joined into one `message`. Unknown body
fields are stripped by Zod.

Date values accept ISO date or date-time strings and are coerced to `Date`.

Time values must use `HH:MM` or `HH:MM:SS` (24-hour).

### 1.13 Path parameter validation

`reservationId` must be a UUID matching the shared UUID pattern (versions 1–5).
Invalid values return `400 Invalid reservationId format`.

### 1.14 Database error mapping

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
| `POST` | `/reservations` | Staff | Create a reservation with assignments |
| `GET` | `/reservations` | Authenticated | List/filter reservations |
| `GET` | `/reservations/:reservationId` | Authenticated | Get one reservation |
| `PATCH` | `/reservations/:reservationId` | Staff | Update guest or booking source |
| `PATCH` | `/reservations/:reservationId/confirm` | Staff | Confirm a pending reservation |
| `PATCH` | `/reservations/:reservationId/cancel` | Staff | Cancel a pending/confirmed reservation |
| `PATCH` | `/reservations/:reservationId/no-show` | Staff | Mark a confirmed reservation as no-show |
| `DELETE` | `/reservations/:reservationId` | Staff | Repair-only deletion |

---

## 3. `POST /reservations`

Create a reservation and its kubo assignments atomically.

### 3.1 Access

Staff only.

### 3.2 Request body

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `guestId` | string (UUID) | Yes | Must reference an existing guest |
| `bookingSource` | string | Yes | One of the values in §1.7 |
| `assignments` | array | Yes | At least one item |
| `assignments[].kuboId` | string (UUID) | Yes | Must reference an existing kubo |
| `assignments[].checkInDate` | date | Yes | Cannot be in the past |
| `assignments[].checkOutDate` | date | Yes | Must be later than check-in |
| `assignments[].scheduledCheckInTime` | string | No | `HH:MM` or `HH:MM:SS` |
| `assignments[].scheduledCheckOutTime` | string | No | Must be later than scheduled check-in when both are supplied |

```json
{
  "guestId": "c1d2e3f4-a5b6-4789-8abc-def012345678",
  "bookingSource": "WalkIn",
  "assignments": [
    {
      "kuboId": "e1f2a3b4-c5d6-4789-8abc-def012345678",
      "checkInDate": "2026-11-10",
      "checkOutDate": "2026-11-12"
    }
  ]
}
```

### 3.3 Success response — `201 Created`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully created Reservation` |
| `reservations` | object | No | Full reservation detail, including `assignments` |

```json
{
  "success": true,
  "message": "Successfully created Reservation",
  "reservations": {
    "reservation_id": "5be2d27d-a10e-440a-acab-95b8020bfecf",
    "reference_code": "RES-20261104-7594",
    "guest_id": "c1d2e3f4-a5b6-4789-8abc-def012345678",
    "guest_name": "Juan Dela Cruz",
    "employee_id": "b52b52f5-14a4-442e-b836-81f8f0e8c476",
    "employee_name": "Metch Amores",
    "status": "Pending",
    "booking_source": "WalkIn",
    "cancelled_at": null,
    "cancellation_reason": null,
    "reserved_at": "2026-11-04T09:00:00.000Z",
    "accommodation_total": "5000.00",
    "charges_total": "5000.00",
    "net_paid": "0.00",
    "outstanding_balance": "5000.00",
    "assignments": [
      {
        "reservation_id": "5be2d27d-a10e-440a-acab-95b8020bfecf",
        "kubo_id": "e1f2a3b4-c5d6-4789-8abc-def012345678",
        "kubo_number": "K-101",
        "kubo_type_id": "d1e2f3a4-b5c6-4789-8abc-def012345678",
        "type_name": "Family Kubo",
        "check_in_date": "2026-11-10",
        "check_out_date": "2026-11-12",
        "scheduled_check_in_time": null,
        "scheduled_check_out_time": null,
        "actual_check_in_datetime": null,
        "actual_check_out_datetime": null,
        "early_check_in_approved": false,
        "price_at_booking": 2500.0,
        "status": "Reserved",
        "nights": 2,
        "amount": 5000.0
      }
    ]
  }
}
```

### 3.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Body fails validation | `400` | Validation detail |
| Guest/employee/booking source missing | `400` | `Guest, employee and booking source are required.` |
| No assignments | `400` | `At least one kubo assignment is required.` |
| Check-out not later than check-in | `400` | `Check-out must be later than check-in.` |
| Check-in date in the past | `400` | `Check-in date cannot be in the past.` |
| Scheduled check-out not later than scheduled check-in | `400` | `Scheduled check-out time must be later than scheduled check-in time.` |
| Guest does not exist | `404` | `Guest does not exist.` |
| Creating employee missing or inactive | `400` | `Creating employee does not exist or is not Active.` |
| Kubo does not exist | `404` | `Kubo does not exist.` |
| Kubo status is `Maintenance`, `OutOfService`, or `UnderInspection` | `400` | `Kubo is not available for booking.` |
| `Cleaning` kubo with same-day check-in | `400` | `Kubo is being cleaned and is not available for a same-day check-in.` |
| Overlapping active assignment for the kubo | `400` | `Kubo is not available for the selected dates.` |
| Reference code generation exhausts retries | `400` | `Unable to generate a unique reservation reference code.` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Creation behavior:

- The reservation is created with status `Pending`.
- `reference_code` is generated as `RES-YYYYMMDD-NNNN` with a random four-digit
  suffix; up to 20 attempts are made.
- `reserved_at` defaults to the current timestamp.
- The acting employee comes from the access token, never from the request.
- Each assignment snapshots the kubo type’s current `price_per_night` into
  `price_at_booking`; later rate changes do not affect it.
- Assignment status starts as `Reserved`.
- A kubo whose status is `Available` is changed to `Reserved`. A `Cleaning` kubo
  with a future check-in remains `Cleaning` while its assignment is `Reserved`.
- Overlap checks ignore reservations in terminal/non-active states.
- The reservation, all assignments, kubo status updates, and the audit row are
  written in one transaction.

### 3.5 Side effects

- Inserts one `kubo.reservation` row.
- Inserts one `kubo.reserved_kubo` row per assignment.
- May update `kubo.kubo.status` to `Reserved`.
- Inserts one `kubo.audit_log` row with `action = Create`,
  `entityType = reservation`, `entityId = reservation_id`.

---

## 4. `GET /reservations`

List or filter reservations.

### 4.1 Access

Any authenticated employee.

### 4.2 Query parameters

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |
| `status` | string | — | One of the values in §1.6 |
| `bookingSource` | string | — | One of the values in §1.7 |
| `search` | string | — | Trimmed; 1–100 characters; matches reference code, guest name, or employee name |
| `guestId` | string (UUID) | — | Exact guest |
| `employeeId` | string (UUID) | — | Exact creating employee |
| `checkInDate` | date | — | Assignment `check_in_date` must be ≥ this date |
| `checkOutDate` | date | — | Assignment `check_out_date` must be ≤ this date |

Empty-string values for `search`, `guestId`, `employeeId`, `checkInDate`, and
`checkOutDate` are treated as not supplied. Empty-string enum values such as
`?status=` fail validation.

### 4.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `count` | integer | No | Number of rows on this page |
| `message` | string | No | `Successfully listed all Reservations` |
| `reservations` | array | No | Ordered by `reserved_at` descending, then `reservation_id` |

Each array item has the full reservation shape from §1.5, including assignments.

### 4.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid pagination or filter values | `400` | Validation detail |
| `checkOutDate` is not later than `checkInDate` | `400` | `Check-out filter must be later than check-in filter.` |
| Not authenticated | `401` | `Authentication required` |
| Unexpected database failure | `500` | `Failed to fetch reservations from database` |

Behavior notes:

- No rows returns `200` with an empty array and `count: 0`.
- `count` is page size, not total matches.
- Date filters use **containment**: a reservation matches when at least one
  assignment has `check_in_date >= checkInDate` and
  `check_out_date <= checkOutDate`. This is not an overlap query.
- Supplying only one of the two date filters applies only that bound.

### 4.5 Side effects

None.

---

## 5. `GET /reservations/:reservationId`

Get one reservation by UUID.

### 5.1 Access

Any authenticated employee.

### 5.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 5.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully fetched Reservation by its ID` |
| `reservations` | object | No | Full reservation detail |

### 5.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid reservationId format` |
| Reservation does not exist | `404` | `Reservation not found` |
| Not authenticated | `401` | `Authentication required` |

### 5.5 Side effects

None.

---

## 6. `PATCH /reservations/:reservationId`

Update the reservation’s guest or booking source. Assignments are not changed here.

### 6.1 Access

Staff only.

### 6.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 6.3 Request body

At least one field is required.

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `guestId` | string (UUID) | No | Must reference an existing guest |
| `bookingSource` | string | No | One of the values in §1.7 |

```json
{
  "guestId": "c1d2e3f4-a5b6-4789-8abc-def012345678",
  "bookingSource": "Phone"
}
```

### 6.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully updated Reservation` |
| `reservations` | object | No | Updated reservation detail |

### 6.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid reservationId format` |
| Body fails validation or has no fields | `400` | Validation detail / `Provide at least one field to update.` |
| Reservation is not `Pending` or `Confirmed` | `400` | `Only Pending or Confirmed reservations can be modified.` |
| Guest does not exist | `404` | `Guest does not exist.` |
| Reservation does not exist | `404` | `Reservation not found` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Only the guest and booking source can change.
- Assignment dates, kubos, and prices are managed through the reserved-kubo module.
- The update and audit row are written in one transaction.

### 6.6 Side effects

- Updates one `kubo.reservation` row.
- Inserts one `kubo.audit_log` row with `action = Update`,
  `entityType = reservation`, `entityId = reservation_id`, including old/new
  snapshots.

---

## 7. `PATCH /reservations/:reservationId/confirm`

Confirm a pending reservation.

### 7.1 Access

Staff only.

### 7.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 7.3 Request body

None.

### 7.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully confirmed Reservation` |
| `reservations` | object | No | Reservation with status `Confirmed` |

### 7.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid reservationId format` |
| Reservation is not `Pending` | `400` | `Only Pending reservations can be confirmed.` |
| Reservation has no assignment | `400` | `A reservation must have at least one kubo assignment.` |
| Reservation does not exist | `404` | `Reservation not found` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Confirmation changes only the reservation status. Assignments remain `Reserved`
  until check-in.
- A cancelled reservation cannot be re-confirmed; create a new reservation.

### 7.6 Side effects

- Updates `kubo.reservation.status` to `Confirmed`.
- Inserts one `kubo.audit_log` row with `action = Update`,
  `entityType = reservation`, `entityId = reservation_id`.

---

## 8. `PATCH /reservations/:reservationId/cancel`

Cancel a pending or confirmed reservation.

### 8.1 Access

Staff only.

### 8.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 8.3 Request body

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `reason` | string | Yes | Trimmed; 1–255 characters |

```json
{
  "reason": "Guest requested to move the booking to a later date"
}
```

### 8.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully cancelled Reservation` |
| `reservations` | object | No | Reservation with status `Cancelled` |

### 8.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid reservationId format` |
| Missing/blank reason | `400` | Validation detail / `Cancellation reason is required.` |
| Reason over 255 characters | `400` | Validation detail |
| Reservation is not `Pending` or `Confirmed` | `400` | `Only Pending or Confirmed reservations can be cancelled.` |
| Reservation does not exist | `404` | `Reservation not found` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Cancellation behavior:

- Sets reservation status to `Cancelled`.
- Sets `cancelled_at` to the current timestamp and stores the trimmed reason.
- Sets every assignment to `Cancelled`.
- Releases kubos to `Available` where no other active assignment still needs them.
- The cancellation and audit row are written in one transaction.

### 8.6 Side effects

- Updates the reservation, all its assignments, and affected kubo statuses.
- Inserts one `kubo.audit_log` row with `action = Cancel`,
  `entityType = reservation`, `entityId = reservation_id`.

---

## 9. `PATCH /reservations/:reservationId/no-show`

Mark a confirmed reservation as a no-show.

### 9.1 Access

Staff only.

### 9.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 9.3 Request body

None.

### 9.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully marked Reservation as NoShow` |
| `reservations` | object | No | Reservation with status `NoShow` |

### 9.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid reservationId format` |
| Reservation is not `Confirmed` | `400` | `Only Confirmed reservations can be marked NoShow.` |
| Reservation has no assignments | `400` | `Reservation has no assignments.` |
| Scheduled check-in date/time has not passed | `400` | `The scheduled check-in date/time has not passed yet.` |
| Reservation does not exist | `404` | `Reservation not found` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- The time check uses the earliest assignment `check_in_date` and the earliest
  `scheduled_check_in_time` independently.
- Sets reservation status to `NoShow`.
- Sets every assignment to `NoShow`.
- Releases kubos to `Available` where no other active assignment still needs them.

### 9.6 Side effects

- Updates the reservation, all its assignments, and affected kubo statuses.
- Inserts one `kubo.audit_log` row with `action = Update`,
  `entityType = reservation`, `entityId = reservation_id`.

---

## 10. `DELETE /reservations/:reservationId`

Repair-only hard deletion. Normal operations use cancellation.

### 10.1 Access

Staff only.

### 10.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 10.3 Request body

None.

### 10.4 Success response — `204 No Content`

No response body.

### 10.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid reservationId format` |
| Reservation does not exist | `404` | `Reservation not found` |
| Reservation has payment or additional-charge history | `409` | `Reservation has financial history; cancel it instead of deleting.` |
| Reservation has custom charge-request history | `409` | `Reservation has custom charge-request history; cancel it instead of deleting.` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Deletion is a repair action. Business cancellations should use `/cancel`.
- Any payment, additional charge, or custom charge-request row blocks deletion.
- Assignment rows are removed by the schema’s `ON DELETE CASCADE` from
  `reserved_kubo.reservation_id`.
- Kubos are released after the reservation is removed.
- The service checks existence before and after the database call.
- The delete audit row is written before the reservation row is removed.

### 10.6 Side effects

- Deletes one `kubo.reservation` row and its assignment rows.
- May update `kubo.kubo.status` to `Available`.
- Inserts one `kubo.audit_log` row with `action = Delete`,
  `entityType = reservation`, `entityId = reservation_id`.

---

## 11. Known contract quirks

- `charges_total` is the **grand total** (accommodation + additional charges), not
  the additional-charge subtotal.
- Totals are derived on every read and are returned as JSON strings; assignment
  amounts inside `assignments` are JSON numbers.
- `reservations` is an object on create/get/update/confirm/cancel/no-show and an
  array on list.
- List date filters use containment, not overlap.
- Empty-string `status` or `bookingSource` query values return `400`.
- `count` is page size, not total.
- Check-in/check-out and assignment changes are **not** in this module.
- Create sets a kubo to `Reserved` only if it was `Available`; a future booking on a
  `Cleaning` kubo leaves the kubo status as `Cleaning`.
- Scheduled times are compared as clock times, not date-times. Supplying both
  `scheduledCheckInTime: "14:00"` and `scheduledCheckOutTime: "12:00"` is rejected
  even when check-out is on a later date. Omit the times to avoid this constraint.
- Delete is Staff-only even though it is a repair action, and is blocked by any
  financial or custom-charge-request history.
- Reference codes use a random four-digit suffix; collisions are retried up to 20
  times.
- `DELETE` returns `204` but the controller calls `res.status(204).json()`; clients
  must treat it as an empty `204`.
