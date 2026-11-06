# Payment Module — API Contract

Payment, refund, and payment-status endpoints for the Kubo Reservation Management
System.

- **Base path:** `API_BASE_PATH` (default `/api`; this repo uses `/KUBO_Resort/Management-System/v0.0.1`)
- **Module mounts:**
  - `/reservations/:reservationId/payments`
  - `/payments`
- **Source files:** `payment.routes.ts`, `payment.controllers.ts`, `payment.services.ts`, `repository/payment.schema.ts`, `repository/payment.repository.ts`
- **Authentication:** All endpoints require a Bearer access token.
- **Authorization:** Reads are open to any authenticated employee. Create, refund, and status updates require **Staff**. Cleanup deletion requires **Administrator**.

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
| `POST`, `PATCH` | `Staff` (stored `role_name` equals `staff`, exact) |
| `DELETE /payments/:paymentId` | `Administrator` (stored `role_name` equals `administrator`, exact) |

The authenticated employee must have status `Active`; otherwise the authentication
middleware returns `403 Account is not active`.

### 1.3 Pagination

`GET /payments` accepts:

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |

`GET /reservations/:reservationId/payments` is **not paginated**.

`count` is the number of rows returned, not a total.

### 1.4 Success envelope

Every successful response includes:

```json
{
  "success": true,
  "message": "Human-readable result"
}
```

Payment payloads are placed under the key **`payments`**. On list responses it is
an array; on single operations it is an object. There is no `data` wrapper.

### 1.5 Payment object

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `payment_id` | string (UUID) | No | Primary key |
| `reservation_id` | string (UUID) | No | |
| `reference_code` | string | No | Reservation reference code |
| `employee_id` | string (UUID) | No | Employee who processed the transaction |
| `recorded_by` | string | No | `first_name + ' ' + last_name` |
| `payment_amount` | string (decimal) | No | PostgreSQL `numeric` serialized as a JSON string |
| `transaction_type` | string | No | See §1.6 |
| `payment_type` | string | No | See §1.7 |
| `payment_method` | string | No | See §1.8 |
| `payment_status` | string | No | See §1.9 |
| `payment_date` | string (ISO 8601) | No | Server-controlled timestamp |

### 1.6 Transaction types

`Payment`, `Refund`, `Adjustment`, `Reversal`.

Only `Payment` and `Refund` are created by this module. `Adjustment` and `Reversal`
are recognized values but have no implemented endpoint or balance effect.

### 1.7 Payment types

`Deposit`, `PartialPayment`, `FullPayment`, `BalancePayment`, `AdditionalCharge`.

### 1.8 Payment methods

`Cash`, `CreditCard`, `DebitCard`, `GCash`, `Maya`, `BankTransfer`,
`OnlineBanking`, `Other`.

### 1.9 Payment status values

`Pending`, `Processing`, `Completed`, `Failed`, `Cancelled`, `Refunded`,
`PartiallyRefunded`.

Allowed manual transitions:

| From | Allowed to |
|---|---|
| `Pending` | `Processing`, `Completed`, `Failed`, `Cancelled` |
| `Processing` | `Completed`, `Failed`, `Cancelled` |
| `Completed` | — (only the refund routine changes it) |
| `PartiallyRefunded` | — (only the refund routine changes it) |
| `Failed` | Terminal |
| `Cancelled` | Terminal |
| `Refunded` | Terminal |

Setting the same status is a no-op that returns the current payment.

### 1.10 Balance effects

- A `Payment` transaction counts as received when its status is `Completed`,
  `PartiallyRefunded`, or `Refunded`.
- A `Refund` transaction reduces net paid only when its status is `Completed`.
- `Pending`, `Processing`, `Failed`, and `Cancelled` rows do not affect the balance.
- Reservation `net_paid` and `outstanding_balance` are always derived, never stored.

### 1.11 Error envelope

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

### 1.12 Request field aliases

Request bodies accept these aliases:

| Contract field | Accepted aliases |
|---|---|
| `paymentAmount` | `payment_amount` |
| `paymentType` | `payment_type` |
| `paymentMethod` | `payment_method` |
| `status` | `paymentStatus`, `payment_status` |
| `originalPaymentId` | `original_payment_id` |

The response always uses snake_case.

### 1.13 Validation behavior

Request bodies are validated with Zod before the controller runs. Validation
failures return `400` with all issues joined into one `message`. Unknown body
fields are stripped by Zod.

`paymentAmount` must be a JSON **number**, not a numeric string. Amounts may have
at most 2 decimal places.

### 1.14 Path parameter validation

`reservationId` and `paymentId` must be UUIDs matching the shared UUID pattern
(versions 1–5). Invalid values return `400 Invalid <param> format`.

### 1.15 Database error mapping

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
| `POST` | `/reservations/:reservationId/payments` | Staff | Record a pending payment |
| `GET` | `/reservations/:reservationId/payments` | Authenticated | List all transactions for a reservation |
| `POST` | `/reservations/:reservationId/payments/refund` | Staff | Record a refund |
| `GET` | `/payments` | Authenticated | Filtered, paginated payment list |
| `GET` | `/payments/:paymentId` | Authenticated | Get one payment |
| `PATCH` | `/payments/:paymentId/status` | Staff | Apply a status transition |
| `DELETE` | `/payments/:paymentId` | Administrator | Cleanup-only deletion |

---

## 3. `POST /reservations/:reservationId/payments`

Record a new payment in `Pending` status.

### 3.1 Access

Staff only.

### 3.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 3.3 Request body

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `paymentAmount` | number | Yes | Non-negative; at most 2 decimal places |
| `paymentType` | string | Yes | One of the values in §1.7 |
| `paymentMethod` | string | Yes | One of the values in §1.8 |

`transaction_type` and `payment_status` are not accepted; the server forces
`Payment` and `Pending`.

```json
{
  "paymentAmount": 5000.0,
  "paymentType": "Deposit",
  "paymentMethod": "GCash"
}
```

### 3.4 Success response — `201 Created`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully created Payment for Reservation` |
| `payments` | object | No | Created payment |

```json
{
  "success": true,
  "message": "Successfully created Payment for Reservation",
  "payments": {
    "payment_id": "f1a2b3c4-d5e6-4789-8abc-def012345678",
    "reservation_id": "5be2d27d-a10e-440a-acab-95b8020bfecf",
    "reference_code": "RES-20261104-7594",
    "employee_id": "b52b52f5-14a4-442e-b836-81f8f0e8c476",
    "recorded_by": "Metch Amores",
    "payment_amount": "5000.00",
    "transaction_type": "Payment",
    "payment_type": "Deposit",
    "payment_method": "GCash",
    "payment_status": "Pending",
    "payment_date": "2026-11-04T09:15:00.000Z"
  }
}
```

### 3.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Body fails validation | `400` | Validation detail |
| Amount negative or more than 2 decimals | `400` | `Payment amount must be non-negative with at most two decimal places.` |
| Payment type/method missing | `400` | `Payment type and method are required.` |
| Reservation does not exist | `404` | `Reservation does not exist.` |
| Reservation is `Cancelled` or `NoShow` | `400` | `Payments cannot be recorded for a <status> reservation.` |
| Amount exceeds outstanding balance | `400` | `Payment exceeds the outstanding balance of <amount>.` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Reservations in `Pending`, `Confirmed`, `CheckedIn`, or `CheckedOut` are eligible.
- A zero amount is accepted.
- The payment is created as `transaction_type = Payment`, `payment_status = Pending`,
  with a server timestamp.
- `Pending` payments do not reduce the outstanding balance. Multiple pending
  payments can therefore be created within the same balance; the final balance
  check happens again when a payment is completed.
- The insert and audit row are written in one transaction.

### 3.6 Side effects

- Inserts one `kubo.payment` row.
- Inserts one `kubo.audit_log` row with `action = Create`, `entityType = payment`,
  `entityId = payment_id`.

---

## 4. `GET /reservations/:reservationId/payments`

List every payment/refund transaction for one reservation.

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
| `count` | integer | No | Number of rows returned |
| `message` | string | No | `Successfully fetched payments by reservation` |
| `payments` | array | No | Ordered by `payment_date`, then `payment_id` ascending |

```json
{
  "success": true,
  "count": 2,
  "message": "Successfully fetched payments by reservation",
  "payments": [
    {
      "payment_id": "f1a2b3c4-d5e6-4789-8abc-def012345678",
      "reservation_id": "5be2d27d-a10e-440a-acab-95b8020bfecf",
      "reference_code": "RES-20261104-7594",
      "employee_id": "b52b52f5-14a4-442e-b836-81f8f0e8c476",
      "recorded_by": "Metch Amores",
      "payment_amount": "5000.00",
      "transaction_type": "Payment",
      "payment_type": "Deposit",
      "payment_method": "GCash",
      "payment_status": "Completed",
      "payment_date": "2026-11-04T09:15:00.000Z"
    }
  ]
}
```

### 4.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid reservationId format` |
| Not authenticated | `401` | `Authentication required` |
| Unexpected database failure | `500` | `Failed to fetch reservation payments` |

Behavior notes:

- Includes all transaction types and all statuses.
- No pagination and no filters.
- A reservation with no transactions returns `200`, `count: 0`, and `[]`.

### 4.5 Side effects

None.

---

## 5. `POST /reservations/:reservationId/payments/refund`

Record a refund against a completed original payment.

### 5.1 Access

Staff only.

### 5.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `reservationId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 5.3 Request body

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `originalPaymentId` | string (UUID) | Yes | Must be a `Payment` transaction of the same reservation |
| `paymentAmount` | number | Yes | Positive; at most 2 decimal places |
| `paymentType` | string | Yes | One of the values in §1.7 |
| `paymentMethod` | string | Yes | One of the values in §1.8 |

```json
{
  "originalPaymentId": "f1a2b3c4-d5e6-4789-8abc-def012345678",
  "paymentAmount": 1500.0,
  "paymentType": "PartialPayment",
  "paymentMethod": "Cash"
}
```

### 5.4 Success response — `201 Created`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully refunded Payment` |
| `payments` | object | No | The **new refund** row, not the original payment |

```json
{
  "success": true,
  "message": "Successfully refunded Payment",
  "payments": {
    "payment_id": "a9b8c7d6-e5f4-4321-8abc-def012345678",
    "reservation_id": "5be2d27d-a10e-440a-acab-95b8020bfecf",
    "reference_code": "RES-20261104-7594",
    "employee_id": "b52b52f5-14a4-442e-b836-81f8f0e8c476",
    "recorded_by": "Metch Amores",
    "payment_amount": "1500.00",
    "transaction_type": "Refund",
    "payment_type": "PartialPayment",
    "payment_method": "Cash",
    "payment_status": "Completed",
    "payment_date": "2026-11-04T09:30:00.000Z"
  }
}
```

### 5.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Body fails validation | `400` | Validation detail |
| Amount zero, negative, or more than 2 decimals | `400` | `Refund amount must be positive with at most two decimal places.` |
| Payment type/method missing | `400` | `Payment type and method are required.` |
| Original payment does not exist | `404` | `Original payment does not exist.` |
| Original belongs to another reservation | `400` | `Original payment does not belong to this reservation.` |
| Original is not a completed payment | `400` | `Refunds require a completed original payment.` |
| Reservation does not exist | `404` | `Reservation does not exist.` |
| Refund exceeds net amount paid | `400` | `Refund exceeds the net amount paid of <amount>.` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Refund behavior:

- The original must have `transaction_type = Payment` and status `Completed` or
  `PartiallyRefunded`. The error message still says “completed”.
- The refund row is created with `transaction_type = Refund`,
  `payment_status = Completed`, and a server timestamp.
- The refund amount is stored as a **positive** number.
- The cumulative refund total is tracked by summing prior refunds linked to the
  original in the **audit description**. There is no `original_payment_id` column.
- If cumulative refunds reach the original amount, the original becomes `Refunded`;
  otherwise it becomes `PartiallyRefunded`.
- Refunds are allowed even when the reservation is `Cancelled` or `NoShow`, provided
  the original payment is valid.
- Two audit rows are written: one for the refund (`Create`) and one for the original
  payment’s status change (`Update`).

### 5.6 Side effects

- Inserts one `kubo.payment` row (`Refund`).
- Updates the original payment’s `payment_status`.
- Inserts two `kubo.audit_log` rows:
  - `action = Create`, `entityType = payment`, `entityId = refund payment_id`,
    description contains `against payment <originalPaymentId>`.
  - `action = Update`, `entityType = payment`, `entityId = original payment_id`.

---

## 6. `GET /payments`

Filtered, paginated list of payments and refunds.

### 6.1 Access

Any authenticated employee.

### 6.2 Query parameters

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |
| `reservationId` | string (UUID) | — | Exact reservation |
| `employeeId` | string (UUID) | — | Exact processing employee |
| `paymentStatus` | string | — | One of the values in §1.9 |
| `paymentMethod` | string | — | One of the values in §1.8 |
| `transactionType` | string | — | One of the values in §1.6 |
| `createdFrom` | date | — | Inclusive lower bound on `payment_date::date` |
| `createdTo` | date | — | Inclusive upper bound on `payment_date::date` |

Empty UUID/date values are treated as not supplied. Empty enum values fail
validation.

### 6.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `count` | integer | No | Number of rows on this page |
| `message` | string | No | `Successfully fetched Payment by filter` |
| `payments` | array | No | Ordered by `payment_date` descending, then `payment_id` |

### 6.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid pagination or filter values | `400` | Validation detail |
| Not authenticated | `401` | `Authentication required` |
| Unexpected database failure | `500` | `Failed to fetch payments` |

Behavior notes:

- No rows returns `200`, `count: 0`, and `[]`.
- `count` is page size, not total matches.
- `createdTo` earlier than `createdFrom` is not rejected; it returns an empty list.
- Ordering here is descending, unlike the per-reservation list.

### 6.5 Side effects

None.

---

## 7. `GET /payments/:paymentId`

Get one payment or refund by UUID.

### 7.1 Access

Any authenticated employee.

### 7.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `paymentId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 7.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully fetched Payment by its ID` |
| `payments` | object | No | Payment or refund row |

### 7.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid paymentId format` |
| Payment does not exist | `404` | `Payment not found` |
| Not authenticated | `401` | `Authentication required` |

### 7.5 Side effects

None.

---

## 8. `PATCH /payments/:paymentId/status`

Apply an allowed payment status transition.

### 8.1 Access

Staff only.

### 8.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `paymentId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 8.3 Request body

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `status` | string | Yes | One of the values in §1.9 |

```json
{
  "status": "Completed"
}
```

### 8.4 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully updated Payment status` |
| `payments` | object | No | Updated payment |

### 8.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID or missing status | `400` | Validation detail |
| Invalid transition | `400` | `Invalid payment status transition from <from> to <to>.` |
| Completing a payment that exceeds outstanding balance | `400` | `Payment exceeds the outstanding balance of <amount>.` |
| Payment does not exist | `404` | `Payment not found` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Setting the same status returns `200` without writing an audit row.
- `Refunded` and `PartiallyRefunded` cannot be set manually; they are produced by
  the refund routine.
- Completing a payment re-checks the outstanding balance, so a previously valid
  pending payment can be blocked if other payments were completed first.
- The update and audit row are written in one transaction.

### 8.6 Side effects

- Updates `kubo.payment.payment_status`.
- Inserts one `kubo.audit_log` row with `action = Update`, `entityType = payment`,
  `entityId = payment_id`, including old/new snapshots.

---

## 9. `DELETE /payments/:paymentId`

Cleanup-only hard deletion. Normal corrections use refunds.

### 9.1 Access

Administrator only.

### 9.2 Path parameters

| Parameter | Type | Required | Constraints |
|---|---|---:|---|
| `paymentId` | string (UUID) | Yes | Must match the shared UUID pattern |

### 9.3 Request body

None.

### 9.4 Success response — `204 No Content`

No response body.

### 9.5 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid paymentId format` |
| Payment does not exist | `404` | `Payment not found` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- The service checks existence before and after the database call.
- The database routine deletes the row without checking its status, amount, or
  transaction type. This is intentionally a development/repair escape hatch.
- Deleting a completed payment or a refund does not recalculate or repair related
  records. Deleting a refund does not restore the original payment’s status.
- The audit row is written after the delete and records the deleted row.

### 9.6 Side effects

- Deletes one `kubo.payment` row.
- Inserts one `kubo.audit_log` row with `action = Delete`, `entityType = payment`,
  `entityId = payment_id`.

---

## 10. Known contract quirks

- Refunds have no stored link to the original payment. The relationship exists only
  in the audit description.
- The refund response returns the new refund row, not the updated original.
- The original payment can be `Completed` or `PartiallyRefunded` when refunded, even
  though the error message says “completed”.
- Refund amounts are stored as positive values; net paid subtracts them.
- Pending payments do not reduce the balance, so several pending payments can exceed
  the balance until completion is attempted.
- Completing a payment can fail due to the balance check even when creation succeeded.
- `payment_amount` is a JSON string in responses but a JSON number in requests.
- Per-reservation payments are ordered ascending; filtered payments are ordered
  descending.
- `createdTo < createdFrom` is not rejected and returns an empty list.
- Cleanup deletion can remove completed payments and refunds without repairing the
  ledger. It is Administrator-only and intended for repair.
- `DELETE` returns `204` but the controller calls `res.status(204).json()`; clients
  must treat it as an empty `204`.
