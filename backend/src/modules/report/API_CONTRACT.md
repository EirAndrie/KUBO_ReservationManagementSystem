# Report API Contract

Read-only management reports. Mounted at `/reports` under the API base path
(`API_BASE_PATH`, for example `/KUBO_Resort/Management-System/v0.0.1/reports`).

---

## 1. Common conventions

| Item | Value |
|---|---|
| Authentication | `Authorization: Bearer <accessToken>` |
| Access | `Administrator` only (stored `role_name` equals `administrator`, exact; BR-005) |
| Envelope | `{ "success": true, "message": "...", "data": { ... } }` |
| Errors | `{ "success": false, "message": "..." }` |
| Money | PostgreSQL `numeric`, serialized as strings with two decimals (`"500.00"`) |
| Days | Calendar dates in the resort time zone, `Asia/Manila` |

---

## 2. `GET /reports/daily`

End-of-day summary for one resort calendar day: cash collected by payment
method, occupancy for that night, and the day's departures with each
reservation's outstanding balance.

### 2.1 Query parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `date` | string | No | `YYYY-MM-DD`, a real calendar date. Omitted or empty means today in Asia/Manila. Past and future dates are allowed. |

### 2.2 Success response — `200 OK`

`data` fields:

| Field | Type | Notes |
|---|---|---|
| `date` | string | The day reported (`YYYY-MM-DD`), resolved by the database when `date` is omitted |
| `timeZone` | string | Always `Asia/Manila` |
| `collections.byMethod` | array | One row per payment method with activity that day (see §2.3); empty when there is none |
| `collections.totals` | object | Sums of the `byMethod` rows: `payments_count`, `collected`, `refunds_count`, `refunded`, `net`, `pending_count`, `pending_amount` |
| `occupancy` | object | `report_date`, `total_kubos`, `booked_kubos`, `arrivals`, `departures` (see §2.4) |
| `departures` | array | Assignments checking out that day (see §2.5) |

### 2.3 Collections rules

A payment row belongs to the day it was recorded (`payment_date` in
Asia/Manila). The schema has no completion timestamp, so a payment recorded
yesterday and completed today counts yesterday.

| Field | Rows counted |
|---|---|
| `collected`, `payments_count` | `transaction_type = Payment` with status `Completed`, `PartiallyRefunded`, or `Refunded` (the `net_paid` rule in `fn_get_reservation_balance`) |
| `refunded`, `refunds_count` | `transaction_type = Refund` with status `Completed`, under the refund's own method |
| `net` | `collected − refunded` |
| `pending_amount`, `pending_count` | `transaction_type = Payment` still `Pending` or `Processing`; not collected |

`Adjustment` and `Reversal` rows are non-cash charge corrections and are never
counted. `Failed` and `Cancelled` payments are ignored.

### 2.4 Occupancy rules

Assignments and reservations with status `Cancelled` or `NoShow` are ignored.

An assignment's **departure day** is the date it actually checked out
(`actual_check_out_datetime` in Asia/Manila) once it is `CheckedOut`;
otherwise its scheduled `check_out_date`. An assignment is **overdue** when it
is still `CheckedIn` after its `check_out_date`; overdue assignments are
reported only in **today's** report, because "still checked in" is a
current-state fact.

| Field | Meaning |
|---|---|
| `total_kubos` | Every kubo row, whatever its status |
| `booked_kubos` | Distinct kubos with an assignment covering that night (`check_in_date <= date < departure day`), plus, in today's report, kubos with an overdue assignment |
| `arrivals` | Assignments with `check_in_date = date` |
| `departures` | Assignments whose departure day is `date`, plus overdue ones in today's report; equals `departures.length` |

This is booked nights, so it works for any date, and an early check-out frees
the later nights. The Administrator dashboard's "Occupancy tonight" instead
counts kubos whose current status is `Occupied`.

### 2.5 Departure row

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `reservation_id` | string (UUID) | No | |
| `reference_code` | string | No | |
| `guest_name` | string | No | First and last name |
| `kubo_id` | string (UUID) | No | |
| `kubo_number` | string | No | |
| `check_out_date` | string | No | `YYYY-MM-DD` |
| `scheduled_check_out_time` | string | Yes | `HH:MM:SS` |
| `assignment_status` | string | No | `Reserved` (never checked in), `CheckedIn` (still to leave), or `CheckedOut` (left) |
| `actual_check_out_datetime` | string | Yes | ISO timestamp once checked out |
| `overdue` | boolean | No | Still `CheckedIn` after `check_out_date` (today's report only) |
| `outstanding_balance` | string (decimal) | No | Derived reservation balance from `fn_get_reservation_balance`; never stored |

Rows are ordered overdue first, then those not yet checked out, then by
scheduled check-out time and kubo number (text order).

### 2.6 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| `date` is not `YYYY-MM-DD` | `400` | `date: date must be YYYY-MM-DD` |
| `date` is not a real calendar date (e.g. `2026-02-30`) | `400` | `date: date is not a valid calendar date` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Unexpected database failure | `500` | `Failed to load daily report` |

### 2.7 Implementation and side effects

- Stored functions (migrations `20261116_add_daily_summary_report.sql` and
  `20261116_refine_daily_summary_report.sql`):
  `kubo_payment_management.fn_get_daily_collections`,
  `kubo_reservation_management.fn_get_daily_departures`, and
  `kubo_reservation_management.fn_get_daily_occupancy`.
- The three run in one read-only `REPEATABLE READ` transaction, so every part
  describes the same snapshot.
- No writes and no audit row.
