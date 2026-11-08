# Additional Charges Module — API Contract

Charge catalog, applied charges, and custom charge-request endpoints for the Kubo
Reservation Management System.

- **Base path:** `/KUBO_Resort/Management-System/v0.0.1`
- **Module mount:** root-mounted route groups:
  - `/additional-charge-catalog`
  - `/reservations/:reservationId/charges`
  - `/reservations/:reservationId/charge-requests`
  - `/additional-charge-requests`
  - `/additional-charges`
- **Source files:** `additional-charges.routes.ts`, `additional-charges.controllers.ts`, `additional-charges.services.ts`, `repository/additional-charge.schema.ts`, `repository/additional-charge.repository.ts`
- **Authentication:** All endpoints require a Bearer access token.

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
| Catalog reads | Any authenticated employee |
| Catalog create/update/delete | `Administrator` |
| Apply catalog charge | `Staff` |
| Applied-charge reads | Any authenticated employee |
| Delete applied charge | `Staff` |
| Add correction | `Administrator` |
| Submit/withdraw custom request | `Staff` (withdraw: requester only) |
| Custom-request reads | Any authenticated employee |
| Approve/reject custom request | `Administrator` |

The authenticated employee must have status `Active`; otherwise the authentication
middleware returns `403 Account is not active`.

### 1.3 Pagination

| Endpoint | Paginated | `count` returned |
|---|---|---|
| `GET /additional-charge-catalog` | Yes | Yes |
| `GET /additional-charges` | Yes | **No** |
| `GET /additional-charge-requests` | Yes | **No** |
| `GET /reservations/:reservationId/charges` | No | No |

Pagination parameters:

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |

When present, `count` is the number of rows returned, not a total.

### 1.4 Success envelope

Every successful response includes:

```json
{
  "success": true,
  "message": "Human-readable result"
}
```

Payload keys:

| Key | Used by |
|---|---|
| `additionalChargeCatalog` | Catalog endpoints |
| `additionalCharges` | Applied-charge endpoints |
| `additionalChargeRequests` | Custom-request endpoints |

Each key holds an object for single operations and an array for lists.

### 1.5 Enum values

**Charge type** (`charge_type`):

`ExtraBed`, `ExtraPerson`, `LateCheckOut`, `EarlyCheckIn`, `RoomService`,
`FoodAndBeverage`, `Laundry`, `CleaningFee`, `Damage`, `LostKey`, `LostItem`,
`Transportation`, `Minibar`, `Other`.

**Charge-request status**:

`Pending`, `Approved`, `Rejected`, `Withdrawn`.

### 1.6 Catalog object

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `catalog_id` | string (UUID) | No | Primary key |
| `charge_type` | string | No | See §1.5 |
| `name` | string | No | Case-insensitively unique |
| `description` | string | Yes | |
| `unit_price` | string (decimal) | No | PostgreSQL `numeric` serialized as a string |
| `is_active` | boolean | No | Defaults to `true` |
| `created_at` | string (ISO 8601) | No | |
| `updated_at` | string (ISO 8601) | No | |
| `usage_count` | string (integer) | No | PostgreSQL `bigint` serialized as a string |
| `applied_total` | string (decimal) | No | Sum of applied charge amounts |

### 1.7 Applied-charge object

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `charge_id` | string (UUID) | No | Primary key |
| `reservation_id` | string (UUID) | No | |
| `reference_code` | string | No | Reservation reference |
| `employee_id` | string (UUID) | No | Employee credited on the charge |
| `recorded_by` | string | No | `first_name + ' ' + last_name` |
| `catalog_id` | string (UUID) | Yes | `NULL` for custom requests/corrections |
| `catalog_name` | string | Yes | Current catalog name; `NULL` without a catalog reference |
| `request_id` | string (UUID) | Yes | Set when created from an approved custom request |
| `charge_type` | string | No | See §1.5 |
| `quantity` | integer | No | Positive |
| `unit_amount` | string (decimal) | No | Snapshot of the unit amount |
| `amount` | string (decimal) | No | `quantity × unit_amount` |
| `description` | string | Yes | Catalog name, request description, or correction reason |
| `charge_date` | string (ISO 8601) | No | Server timestamp |

### 1.8 Charge-request object

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `request_id` | string (UUID) | No | Primary key |
| `reservation_id` | string (UUID) | No | |
| `reference_code` | string | No | Reservation reference |
| `guest_name` | string | No | Guest full name |
| `requested_by` | string (UUID) | No | Requesting Staff employee |
| `requested_by_name` | string | No | Employee full name |
| `charge_type` | string | No | Always `Other` for custom requests |
| `description` | string | No | 1–255 characters |
| `quantity` | integer | No | Positive |
| `proposed_unit_amount` | string (decimal) | No | |
| `status` | string | No | See §1.5 |
| `reviewed_by` | string (UUID) | Yes | Administrator who reviewed |
| `reviewed_by_name` | string | Yes | |
| `approved_unit_amount` | string (decimal) | Yes | Set on approval |
| `review_reason` | string | Yes | Approval/rejection/withdrawal reason |
| `created_at` | string (ISO 8601) | No | |
| `reviewed_at` | string (ISO 8601) | Yes | |

### 1.9 Error envelope

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

### 1.10 Request field aliases

Request bodies accept these aliases:

| Contract field | Accepted aliases |
|---|---|
| `chargeType` | `charge_type` |
| `unitPrice` | `unit_price` |
| `isActive` | `is_active` |
| `catalogId` | `catalog_id` |
| `proposedUnitAmount` | `proposed_unit_amount` |
| `unitAmount` | `unit_amount` |

The response always uses snake_case.

### 1.11 Validation behavior

Request bodies are validated with Zod before the controller runs. Validation
failures return `400` with all issues joined into one `message`. Unknown body
fields are stripped by Zod.

Monetary values must be JSON numbers with at most 2 decimal places. Quantities
must be positive integers unless stated otherwise.

### 1.12 Path parameter validation

`catalogId`, `reservationId`, `chargeId`, and `requestId` must be UUIDs matching
the shared UUID pattern (versions 1–5). Invalid values return
`400 Invalid <param> format`.

### 1.13 Settlement definition

A reservation is **settled** when either condition is true:

- Its status is `CheckedOut`, `Cancelled`, or `NoShow`.
- It has any completed `Payment` or `Refund` transaction.

Settlement blocks applied-charge deletion. It does **not** block applying new
charges or submitting custom requests.

### 1.14 Database error mapping

| PostgreSQL code | HTTP status |
|---|---:|
| `23505` | `400` |
| `23001` | `409` |
| `23503` | `409` |
| `23514` | `400` |
| `22023` | `400` |
| `P0002` | `404` |
| `42501` | `403` |
| Any other code | `500` |

---

## 2. Endpoint summary

### Catalog

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/additional-charge-catalog` | Authenticated | List/search catalog items |
| `GET` | `/additional-charge-catalog/:catalogId` | Authenticated | Get one catalog item |
| `POST` | `/additional-charge-catalog` | Administrator | Create a catalog item |
| `PATCH` | `/additional-charge-catalog/:catalogId` | Administrator | Update a catalog item |
| `PATCH` | `/additional-charge-catalog/:catalogId/status` | Administrator | Alias of the update endpoint |
| `DELETE` | `/additional-charge-catalog/:catalogId` | Administrator | Delete an unused catalog item |

### Applied charges

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/reservations/:reservationId/charges` | Staff | Apply a catalog item |
| `GET` | `/reservations/:reservationId/charges` | Authenticated | List charges for a reservation |
| `GET` | `/additional-charges` | Authenticated | Filtered charge list |
| `GET` | `/additional-charges/:chargeId` | Authenticated | Get one applied charge |
| `DELETE` | `/additional-charges/:chargeId` | Staff | Delete a pre-settlement charge |
| `POST` | `/additional-charges/:chargeId/corrections` | Administrator | Add an additive correction |

### Custom requests

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/reservations/:reservationId/charge-requests` | Staff | Submit a custom request |
| `GET` | `/additional-charge-requests` | Authenticated | Filtered request list |
| `GET` | `/additional-charge-requests/:requestId` | Authenticated | Get one request |
| `PATCH` | `/additional-charge-requests/:requestId/approve` | Administrator | Approve a pending request |
| `PATCH` | `/additional-charge-requests/:requestId/reject` | Administrator | Reject a pending request |
| `PATCH` | `/additional-charge-requests/:requestId/withdraw` | Staff (requester) | Withdraw a pending request |

---

## 3. `GET /additional-charge-catalog`

List or search catalog items.

### 3.1 Access

Any authenticated employee.

### 3.2 Query parameters

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |
| `search` | string | — | Matches `name` or `description` |
| `activeOnly` | boolean | `true` | Only literal `"true"` enables the filter |

`activeOnly` parsing quirk: absent → `true`; `?activeOnly=true` → `true`;
`?activeOnly=false`, `?activeOnly=0`, and `?activeOnly=` → `false`.

### 3.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `count` | integer | No | Number of rows on this page |
| `message` | string | No | `Successfully listed additional-charge catalog` |
| `additionalChargeCatalog` | array | No | Ordered by `name`, `catalog_id` |

```json
{
  "success": true,
  "count": 1,
  "message": "Successfully listed additional-charge catalog",
  "additionalChargeCatalog": [
    {
      "catalog_id": "b1c2d3e4-f5a6-4789-8abc-def012345678",
      "charge_type": "ExtraBed",
      "name": "Extra Bed",
      "description": "Rollaway bed per night",
      "unit_price": "500.00",
      "is_active": true,
      "created_at": "2026-11-04T08:00:00.000Z",
      "updated_at": "2026-11-04T08:00:00.000Z",
      "usage_count": "3",
      "applied_total": "1500.00"
    }
  ]
}
```

### 3.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid pagination or search | `400` | Validation detail |
| Not authenticated | `401` | `Authentication required` |
| Unexpected database failure | `500` | `Failed to fetch additional-charge catalog` |

### 3.5 Side effects

None.

---

## 4. `GET /additional-charge-catalog/:catalogId`

Get one catalog item.

### 4.1 Access

Any authenticated employee.

### 4.2 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully fetched catalog item` |
| `additionalChargeCatalog` | object | No | Catalog item |

### 4.3 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid catalogId format` |
| Catalog item does not exist | `404` | `Catalog item not found` |
| Not authenticated | `401` | `Authentication required` |

### 4.4 Side effects

None.

---

## 5. `POST /additional-charge-catalog`

Create a catalog item.

### 5.1 Access

Administrator only.

### 5.2 Request body

| Field | Type | Required | Default | Constraints |
|---|---|---:|---|---|
| `chargeType` | string | Yes | — | See §1.5 |
| `name` | string | Yes | — | 1–100 characters; case-insensitively unique |
| `description` | string | No | — | Maximum 255 characters |
| `unitPrice` | number | Yes | — | Non-negative; at most 2 decimals |
| `isActive` | boolean | No | `true` | |

```json
{
  "chargeType": "ExtraBed",
  "name": "Extra Bed",
  "description": "Rollaway bed per night",
  "unitPrice": 500.0,
  "isActive": true
}
```

### 5.3 Success response — `201 Created`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully created additional-charge catalog item` |
| `additionalChargeCatalog` | object | No | Created item |

### 5.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Body fails validation | `400` | Validation detail |
| Charge type missing | `400` | `Charge type is required.` |
| Name blank or over 100 characters | `400` | `Catalog name must be between 1 and 100 characters.` |
| Description over 255 characters | `400` | `Catalog description cannot exceed 255 characters.` |
| Negative price or more than 2 decimals | `400` | `Unit price must be non-negative with at most two decimal places.` |
| Name already exists | `400` | `A catalog item with that name already exists.` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

### 5.5 Side effects

- Inserts one `kubo.additional_charge_catalog` row.
- Inserts one `kubo.audit_log` row with `action = Create`,
  `entityType = additional_charge_catalog`, `entityId = catalog_id`.

---

## 6. `PATCH /additional-charge-catalog/:catalogId`

Update a catalog item.

Both catalog PATCH paths use the same handler and schema:

- `PATCH /additional-charge-catalog/:catalogId`
- `PATCH /additional-charge-catalog/:catalogId/status`

Neither path is restricted to a single field.

### 6.1 Access

Administrator only.

### 6.2 Request body

At least one field is required.

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `chargeType` | string | No | See §1.5 |
| `name` | string | No | 1–100 characters; case-insensitively unique |
| `description` | string \| null | No | Maximum 255 characters; `null` clears it |
| `unitPrice` | number | No | Non-negative; at most 2 decimals |
| `isActive` | boolean | No | |

```json
{
  "unitPrice": 550.0,
  "isActive": false
}
```

### 6.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully updated catalog item` |
| `additionalChargeCatalog` | object | No | Updated item |

### 6.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID/body | `400` | Validation detail |
| Empty body | `400` | `Provide at least one catalog field to update.` |
| Name blank or over 100 characters | `400` | `Catalog name must be between 1 and 100 characters.` |
| Description over 255 characters | `400` | `Catalog description cannot exceed 255 characters.` |
| Negative price or more than 2 decimals | `400` | `Unit price must be non-negative with at most two decimal places.` |
| Name already exists | `400` | `A catalog item with that name already exists.` |
| Catalog item does not exist | `404` | `Catalog item not found` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Sending `description: null` clears the description to `NULL`.
- Sending `description: ""` is normalized to “not supplied” and leaves the existing
  description unchanged.
- `isActive: false` is the supported way to retire a used catalog item.
- Updates do not alter previously applied charges; each applied charge retains its
  own snapshot.
- The update and audit row are written in one transaction.

### 6.5 Side effects

- Updates one `kubo.additional_charge_catalog` row.
- Inserts one `kubo.audit_log` row with `action = Update`,
  `entityType = additional_charge_catalog`, `entityId = catalog_id`.

---

## 7. `PATCH /additional-charge-catalog/:catalogId/status`

Alias of `PATCH /additional-charge-catalog/:catalogId`.

### 7.1 Access

Administrator only.

### 7.2 Request body

Same schema as §6.2. The path is **not** status-only; any subset of catalog fields is
accepted.

```json
{
  "isActive": false
}
```

### 7.3 Success response — `200 OK`

Same response shape and message as §6.3: `Successfully updated catalog item`.

### 7.4 Business rules and failures

Identical to §6.4. There is no separate status-transition rule beyond setting
`is_active`.

### 7.5 Side effects

- Updates one `kubo.additional_charge_catalog` row.
- Inserts one `kubo.audit_log` row with `action = Update`,
  `entityType = additional_charge_catalog`, `entityId = catalog_id`.

---

## 8. `DELETE /additional-charge-catalog/:catalogId`

Delete a catalog item that has never been applied.

### 7.1 Access

Administrator only.

### 7.2 Success response — `204 No Content`

No response body.

### 7.3 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid catalogId format` |
| Catalog item does not exist | `404` | `Catalog item not found` |
| Item has been used by any applied charge | `409` | `Catalog item has been used. Deactivate it instead of deleting.` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Usage is checked against `kubo.additional_charge.catalog_id`.
- Used items must be deactivated instead of deleted.
- The service checks existence before and after the database call.
- The delete audit row is written before the row is removed.

### 7.4 Side effects

- Deletes one `kubo.additional_charge_catalog` row.
- Inserts one `kubo.audit_log` row with `action = Delete`,
  `entityType = additional_charge_catalog`, `entityId = catalog_id`.

---

## 9. `POST /reservations/:reservationId/charges`

Apply an active catalog item to a reservation.

### 8.1 Access

Staff only.

### 8.2 Request body

| Field | Type | Required | Default | Constraints |
|---|---|---:|---|---|
| `catalogId` | string (UUID) | Yes | — | Must reference an existing catalog item |
| `quantity` | integer | No | `1` | Positive |

```json
{
  "catalogId": "b1c2d3e4-f5a6-4789-8abc-def012345678",
  "quantity": 2
}
```

### 8.3 Success response — `201 Created`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully applied catalog charge` |
| `additionalCharges` | object | No | Created applied charge |

### 8.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID/body | `400` | Validation detail |
| Quantity zero/negative | `400` | `Quantity must be a positive integer.` |
| Reservation does not exist | `404` | `Reservation does not exist.` |
| Reservation is `Cancelled` or `NoShow` | `400` | `Charges cannot be applied to a <status> reservation.` |
| Catalog item does not exist | `404` | `Catalog item does not exist.` |
| Catalog item is inactive | `400` | `Catalog item is inactive.` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Eligible reservation statuses: `Pending`, `Confirmed`, `CheckedIn`, `CheckedOut`.
- The applied charge snapshots `charge_type`, `quantity`, `unit_amount`, and
  `amount = quantity × unit_price`.
- `description` is set to the **catalog name**; the catalog description is not
  copied.
- `catalog_name` in read responses is joined from the current catalog row, so a
  later catalog rename changes `catalog_name` but not the stored `description`.
- Later catalog price changes do not alter existing applied charges.
- The insert and audit row are written in one transaction.

### 8.5 Side effects

- Inserts one `kubo.additional_charge` row.
- Inserts one `kubo.audit_log` row with `action = Create`,
  `entityType = additional_charge`, `entityId = charge_id`.

---

## 10. `GET /reservations/:reservationId/charges`

List applied charges for one reservation.

### 9.1 Access

Any authenticated employee.

### 9.2 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully fetched reservation charges` |
| `additionalCharges` | array | No | Ordered by `charge_date`, `charge_id` |

### 9.3 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid reservationId format` |
| Not authenticated | `401` | `Authentication required` |
| Unexpected database failure | `500` | `Failed to fetch reservation charges` |

Behavior notes:

- There is **no reservation existence check**. An unknown reservation returns
  `200` with an empty array.
- No pagination and no `count`.
- Includes charges created from catalog items, approved requests, and corrections.

### 9.4 Side effects

None.

---

## 11. `GET /additional-charges`

Filtered, paginated applied-charge list.

### 10.1 Access

Any authenticated employee.

### 10.2 Query parameters

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |
| `reservationId` | string (UUID) | — | Exact reservation |
| `employeeId` | string (UUID) | — | Exact employee |
| `chargeType` | string | — | One of the values in §1.5 |
| `createdFrom` | date | — | Inclusive lower bound on `charge_date::date` |
| `createdTo` | date | — | Inclusive upper bound on `charge_date::date` |

### 10.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully listed applied charges` |
| `additionalCharges` | array | No | Ordered by `charge_date` descending, then `charge_id` |

`count` is **not** returned even though pagination applies.

### 10.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid pagination or filter values | `400` | Validation detail |
| Not authenticated | `401` | `Authentication required` |
| Unexpected database failure | `500` | `Failed to fetch applied charges` |

Behavior notes:

- No rows returns `200` with an empty array.
- `createdTo < createdFrom` is not rejected; it returns an empty list.

### 10.5 Side effects

None.

---

## 12. `GET /additional-charges/:chargeId`

Get one applied charge.

### 11.1 Access

Any authenticated employee.

### 11.2 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully fetched applied charge` |
| `additionalCharges` | object | No | Applied charge |

### 11.3 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid chargeId format` |
| Charge does not exist | `404` | `Additional charge not found` |
| Not authenticated | `401` | `Authentication required` |

### 11.4 Side effects

None.

---

## 13. `DELETE /additional-charges/:chargeId`

Delete an applied charge before settlement.

### 12.1 Access

Staff only.

### 12.2 Success response — `204 No Content`

No response body.

### 12.3 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid chargeId format` |
| Charge does not exist | `404` | `Additional charge not found` |
| Reservation is settled | `400` | `Charge cannot be deleted after settlement.` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Settlement means a terminal reservation status **or** any completed payment/refund.
- Once any completed payment/refund exists, charges can no longer be deleted.
- The service checks existence before and after the database call.
- Deleting a charge reduces the derived reservation total.
- The delete audit row is written after the row is removed, using the old snapshot.

### 12.4 Side effects

- Deletes one `kubo.additional_charge` row.
- Inserts one `kubo.audit_log` row with `action = Delete`,
  `entityType = additional_charge`, `entityId = charge_id`.

---

## 14. `POST /additional-charges/:chargeId/corrections`

Add an additive Administrator correction based on an existing charge.

### 13.1 Access

Administrator only.

### 13.2 Request body

| Field | Type | Required | Default | Constraints |
|---|---|---:|---|---|
| `chargeType` | string | Yes | — | See §1.5 |
| `quantity` | integer | No | `1` | Positive |
| `unitAmount` | number | Yes | — | Non-negative; at most 2 decimals |
| `reason` | string | Yes | — | 1–255 characters |

```json
{
  "chargeType": "Damage",
  "quantity": 1,
  "unitAmount": 750.0,
  "reason": "Additional damage assessment after inspection"
}
```

### 13.3 Success response — `201 Created`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully recorded charge correction` |
| `additionalCharges` | object | No | Newly created charge |

### 13.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID/body | `400` | Validation detail |
| Charge type missing | `400` | `Charge type is required.` |
| Quantity zero/negative | `400` | `Quantity must be a positive integer.` |
| Invalid unit amount | `400` | `Unit amount must be non-negative with at most two decimal places.` |
| Missing/blank reason | `400` | `A correction reason is required.` |
| Original charge does not exist | `404` | `Additional charge not found` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Corrections are **additive**: a new charge is inserted and the original charge is
  never edited or deleted.
- The new charge uses the correction’s own type, quantity, unit amount, and reason.
- There is no validation that the correction increases the amount versus the
  original. Because it is additive, any correction increases the total.
- `catalog_id` and `request_id` are `NULL` on the new charge.
- The correction is not linked to the original except through the audit description.

### 13.5 Side effects

- Inserts one `kubo.additional_charge` row.
- Inserts one `kubo.audit_log` row with `action = Create`,
  `entityType = additional_charge`, `entityId = new charge_id`, description
  `Administrator increase correction`.

---

## 15. `POST /reservations/:reservationId/charge-requests`

Submit a custom (`Other`) charge request for Administrator review.

### 14.1 Access

Staff only.

### 14.2 Request body

| Field | Type | Required | Default | Constraints |
|---|---|---:|---|---|
| `description` | string | Yes | — | 1–255 characters |
| `quantity` | integer | No | `1` | Positive |
| `proposedUnitAmount` | number | Yes | — | Non-negative; at most 2 decimals |

```json
{
  "description": "Airport transfer to Clark",
  "quantity": 1,
  "proposedUnitAmount": 1800.0
}
```

### 14.3 Success response — `201 Created`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully submitted custom charge request` |
| `additionalChargeRequests` | object | No | Created request with status `Pending` |

### 14.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID/body | `400` | Validation detail |
| Description blank/over 255 | `400` | `A description between 1 and 255 characters is required.` |
| Quantity zero/negative | `400` | `Quantity must be a positive integer.` |
| Invalid proposed amount | `400` | `Proposed unit amount must be non-negative with at most two decimal places.` |
| Reservation does not exist | `404` | `Reservation does not exist.` |
| Reservation is `Cancelled` or `NoShow` | `400` | `Custom requests cannot be submitted for a <status> reservation.` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- Eligible reservation statuses: `Pending`, `Confirmed`, `CheckedIn`, `CheckedOut`.
- `charge_type` is forced to `Other`.
- The request starts as `Pending` and does **not** affect the reservation balance.
- Only approved requests create an applied charge.
- The insert and audit row are written in one transaction.

### 14.5 Side effects

- Inserts one `kubo.additional_charge_request` row.
- Inserts one `kubo.audit_log` row with `action = Create`,
  `entityType = additional_charge_request`, `entityId = request_id`.

---

## 16. `GET /additional-charge-requests`

Filtered, paginated custom-request list.

### 15.1 Access

Any authenticated employee.

### 15.2 Query parameters

| Parameter | Type | Default | Constraints |
|---|---|---:|---|
| `page` | integer | `1` | Positive |
| `limit` | integer | `10` | Positive, maximum `100` |
| `status` | string | — | One of the values in §1.5 |
| `reservationId` | string (UUID) | — | Exact reservation |
| `requestedBy` | string (UUID) | — | Exact requesting employee |

### 15.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully listed custom charge requests` |
| `additionalChargeRequests` | array | No | Ordered by `created_at` descending, then `request_id` |

`count` is **not** returned even though pagination applies.

### 15.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid pagination or filter values | `400` | Validation detail |
| Not authenticated | `401` | `Authentication required` |
| Unexpected database failure | `500` | `Failed to fetch custom charge requests` |

### 15.5 Side effects

None.

---

## 17. `GET /additional-charge-requests/:requestId`

Get one custom request.

### 16.1 Access

Any authenticated employee.

### 16.2 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully fetched custom charge request` |
| `additionalChargeRequests` | object | No | Request row |

### 16.3 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid requestId format` |
| Request does not exist | `404` | `Charge request not found` |
| Not authenticated | `401` | `Authentication required` |

### 16.4 Side effects

None.

---

## 18. `PATCH /additional-charge-requests/:requestId/approve`

Approve a pending custom request and create the applied charge.

### 17.1 Access

Administrator only.

### 17.2 Request body

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `approvedUnitAmount` | number | No | Non-negative; at most 2 decimals; defaults to the proposed amount |
| `reason` | string | No | Maximum 255 characters; required when the approved amount differs from the proposed amount |

```json
{
  "approvedUnitAmount": 1700.0,
  "reason": "Approved at the standard transfer rate"
}
```

### 17.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully approved custom charge request` |
| `additionalChargeRequests` | object | No | Request with status `Approved` |

### 17.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID/body | `400` | Validation detail |
| Invalid approved amount | `400` | `Approved unit amount must be non-negative with at most two decimal places.` |
| Amount adjusted without a reason | `400` | `A reason is required when adjusting the approved amount.` |
| Request does not exist | `404` | `Charge request not found` |
| Request is not `Pending` | `400` | `Only Pending requests can be approved.` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Approval behavior:

- `approved_unit_amount` defaults to `proposed_unit_amount`.
- If the approved amount differs from the proposed amount, a non-blank reason is
  required.
- Sets the request to `Approved`, records the reviewer and review timestamp.
- Creates one applied charge with:
  - `charge_type = Other`
  - the request’s quantity and description
  - `unit_amount = approvedUnitAmount`
  - `amount = quantity × approvedUnitAmount`
  - `request_id = requestId`
  - `employee_id = requested_by` (the requesting Staff member, not the reviewer)
- Writes two audit rows: one for the request (`Update`) and one for the new charge
  (`Create`).
- Approval does not re-check the reservation’s current status.

### 17.5 Side effects

- Updates one `kubo.additional_charge_request` row.
- Inserts one `kubo.additional_charge` row.
- Inserts two `kubo.audit_log` rows.

---

## 19. `PATCH /additional-charge-requests/:requestId/reject`

Reject a pending custom request.

### 18.1 Access

Administrator only.

### 18.2 Request body

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `reason` | string | Yes | Trimmed; 1–255 characters |

```json
{
  "reason": "Service is not offered for this reservation type"
}
```

### 18.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully rejected custom charge request` |
| `additionalChargeRequests` | object | No | Request with status `Rejected` |

### 18.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID/body | `400` | Validation detail |
| Missing/blank reason | `400` | `A rejection reason is required.` |
| Request does not exist | `404` | `Charge request not found` |
| Request is not `Pending` | `400` | `Only Pending requests can be rejected.` |
| Not authenticated | `401` | `Authentication required` |
| Not an Administrator | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

### 18.5 Side effects

- Updates one `kubo.additional_charge_request` row to `Rejected`.
- Inserts one `kubo.audit_log` row with `action = Update`,
  `entityType = additional_charge_request`, `entityId = request_id`.

---

## 20. `PATCH /additional-charge-requests/:requestId/withdraw`

Withdraw a pending custom request. Only the Staff member who submitted it may
withdraw.

### 19.1 Access

Staff only, and the acting employee must be `requested_by`.

### 19.2 Request body

None.

### 19.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully withdrew custom charge request` |
| `additionalChargeRequests` | object | No | Request with status `Withdrawn` |

### 19.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Invalid UUID | `400` | `Invalid requestId format` |
| Request does not exist | `404` | `Charge request not found` |
| Acting employee is not the requester | `403` | `Only the requesting Staff member may withdraw this request.` |
| Request is not `Pending` | `400` | `Only Pending requests can be withdrawn.` |
| Not authenticated | `401` | `Authentication required` |
| Not Staff | `403` | `Insufficient privileges` |
| Audit write fails | `500` | Database/fallback error |

Withdrawal behavior:

- Sets status to `Withdrawn`.
- Sets `review_reason` to `Withdrawn by Staff`.
- Sets `reviewed_at` to the current timestamp.
- Does not create or delete any applied charge.

### 19.5 Side effects

- Updates one `kubo.additional_charge_request` row.
- Inserts one `kubo.audit_log` row with `action = Update`,
  `entityType = additional_charge_request`, `entityId = request_id`.

---

## 21. Known contract quirks

- `usage_count` is a PostgreSQL `bigint` and is therefore a JSON **string**
  (`"3"`), not a number.
- Catalog `unit_price`, `applied_total`, charge amounts, and request amounts are
  JSON strings.
- Catalog rename changes `catalog_name` in applied-charge reads, but the stored
  `description` remains the name captured at application time.
- Applied catalog charges copy the catalog **name**, not its description.
- `description: null` clears a catalog description; `description: ""` is treated as
  “not supplied”.
- Both catalog PATCH paths accept arbitrary update fields; `/status` is only an
  alias.
- `GET /reservations/:reservationId/charges` returns `200 []` for an unknown
  reservation.
- `GET /additional-charges` and `GET /additional-charge-requests` paginate but omit
  `count`; only the catalog list returns `count`.
- Settlement blocks deletion of applied charges, but does not block adding new
  charges or submitting requests.
- Corrections always add a new charge and never reduce or edit the original. There
  is no validation that the correction is larger.
- Approval credits the requesting Staff employee on the applied charge, not the
  reviewing Administrator.
- Approval does not re-check whether the reservation is still editable or unsettled.
- `activeOnly` is enabled only by the literal string `true`; any other supplied
  value disables it.
- `DELETE` responses are `204` but controllers call `res.status(204).json()`;
  clients must treat them as empty.
