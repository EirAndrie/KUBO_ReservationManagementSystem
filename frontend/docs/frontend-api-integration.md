# Frontend API Integration Guide

This guide reflects the Express routes mounted in `backend/src/modules/index.ts` and the request and response contracts implemented by the backend modules. The module `API_CONTRACT.md` files linked below remain the source for complete field constraints, enum values, and business-rule failures.

## Base URL and headers

The backend mounts the API under this path (there is no `/api` segment):

```text
http://localhost:8080/KUBO_Resort/Management-System/v0.0.1
```

Set `VITE_API_BASE_URL` in `frontend/.env` to the reachable backend origin plus that prefix. The checked-in `frontend/.env.example` uses the local URL above. The backend port comes from `PORT` in `backend/.env` and defaults to `8080`; CORS allows the configured `FR_ORIGIN`.

Send JSON bodies with `Content-Type: application/json`. All endpoints except `POST /auth/login` require:

```http
Authorization: Bearer <accessToken>
```

The employee acting on a write is always identified by the signed-in token. Do not send an `employeeId` to choose or impersonate the actor.

## Client behavior

The current Axios instance is `frontend/src/lib/api.ts`:

- It uses `VITE_API_BASE_URL` (or the local URL above), a 10-second timeout, and `withCredentials: true`.
- It attaches a Bearer token from `kubo_access_token`, falling back to `kubo_token` in local storage.
- It unwraps successful Axios responses to `response.data`; service functions receive the backend JSON body directly.
- A `401` clears the saved token and user, then redirects to `/login` except for a failed login request. `403` and server errors are returned as `ApiError` values with the backend message and HTTP status.
- Sign-in is `POST /auth/login`; the response's `accessToken` and `employee` are mapped into the app session. Sign-out calls `POST /auth/logout` as a best-effort audit, then clears the local session.

## Response and pagination conventions

There is no universal `{ data, meta }` response. Successful JSON responses generally include `success: true` and `message`, with the resource under a module-specific key:

| Resource | Response key |
|---|---|
| Current user / sign-in | `employee` (profile fields are camelCase) |
| Roles | `roles` |
| Guests | `guests` |
| Kubo types | `kuboTypes` |
| Kubos | `kubos` |
| Employees | `employees` |
| Reservations | `reservations` |
| Kubo assignments | `reservedKubos` |
| Payments and refunds | `payments` |
| Catalog items | `additionalChargeCatalog` |
| Applied charges | `additionalCharges` |
| Custom charge requests | `additionalChargeRequests` |
| Audit records | `auditLogs` |

List resources are arrays and single-resource operations return one object, except where a module contract says otherwise. Many—but not all—list endpoints include `count`; it is generally the number of rows on the current page, not the total number of matches. Paginated endpoints usually take `page` and `limit` (default 1 and 10; maximum limit 100). Filters differ by endpoint. Use the linked module contract rather than assuming a shared pagination or filter shape.

The backend's shared paginated controllers accept `page` and `limit`; an `offset` query parameter is not a substitute and is stripped by the shared Zod query schema. Several current frontend services (`guest`, `reservation`, `payment`, and audit-log list) still expose or send `offset`, so non-first-page requests through those services can repeat page 1. Use `page`/`limit` for those routes, or translate a local offset to `page = floor(offset / limit) + 1` before sending it. The audit entity-history endpoint has its own `limit`/`offset` contract.

PostgreSQL `numeric` and `bigint` values commonly arrive as JSON strings. Parse them explicitly for arithmetic and use decimal-safe handling for money. Response row fields are often snake_case; auth profile fields and request bodies use camelCase. Follow each resource's contract rather than applying one casing rule globally.

Errors use this shape and an HTTP error status:

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

Successful deletes commonly return `204 No Content`; do not try to parse a JSON body for those responses. Check each endpoint contract for its status code.

## Live routes and request bodies

All paths below are relative to the base URL above. `:id` segments are UUIDs unless the module contract specifies another format. Omit optional fields when they are not being changed; use `null` only where the route explicitly supports clearing a value.

### Authentication

| Method and path | Access | Request body | Success payload |
|---|---|---|---|
| `POST /auth/login` | Public | `{"username":"staff.user","password":"Secret123!"}` | `accessToken`, `tokenType`, `employee` |
| `GET /auth/me` | Authenticated | None | `employee` |
| `POST /auth/logout` | Authenticated | None | `204 No Content` |

### Guests

| Method and path | Access | Request body / query | Success payload |
|---|---|---|---|
| `POST /guests` | Staff | `{ "firstName":"Juan", "lastName":"Dela Cruz", "email":"juan@example.com", "phone":"09171234567", "validIdType":"Passport", "idNumber":"P1234567A", "addressLine1":"12 Mabini Street", "city":"Cebu City", "stateProvince":"Cebu", "zipPostalCode":"6000", "country":"Philippines" }` (address fields optional) | `guests` and `reused`; matching email or ID can reuse an existing guest with `200` |
| `GET /guests` | Authenticated | Query: `page`, `limit`, `search`, `validIdType` | `guests` |
| `GET /guests/:guestId` | Authenticated | None | `guests` |
| `PATCH /guests/:guestId` | Staff | Any subset of `firstName`, `lastName`, `email`, `phone`, `addressLine1`, `city`, `stateProvince`, `zipPostalCode`, `country`, `validIdType`, `idNumber` | `guests` |
| `DELETE /guests/:guestId` | Administrator | None | `204 No Content` when unused |

### Roles, kubo types, and kubos

| Method and path | Access | Exact request body | Success payload |
|---|---|---|---|
| `POST /roles` | Administrator | `{ "roleName":"FrontDesk", "description":"Handles front-desk operations" }` | `roles` |
| `PATCH /roles/:roleId` | Administrator | Partial `{ "roleName":"Staff", "description":"Front-desk staff" }` | `roles` |
| `GET /roles`, `GET /roles/:roleId` | Authenticated | None | `roles` |
| `DELETE /roles/:roleId` | Administrator | None | `204 No Content` when unused |
| `POST /kubo-types` | Administrator | `{ "kuboTypeName":"Family Kubo", "kuboTypeCapacity":4, "pricePerNight":2500, "kuboTypeDescription":"Two-bedroom kubo" }` | `kuboTypes` |
| `PATCH /kubo-types/:kuboTypeId` | Administrator | Partial `{ "pricePerNight":2750, "kuboTypeDescription":"Updated description" }` | `kuboTypes` |
| `GET /kubo-types`, `GET /kubo-types/:kuboTypeId` | Authenticated | List filters: `page`, `limit`, `search`, `minCapacity`, `maxCapacity` | `kuboTypes` |
| `DELETE /kubo-types/:kuboTypeId` | Administrator | None | `204 No Content` when not referenced |
| `POST /kubos` | Administrator | `{ "kuboNumber":"K-102", "kuboTypeId":"<uuid>" }` (optional `status`) | `kubos` |
| `PATCH /kubos/:kuboId` | Administrator | Partial `{ "kuboNumber":"K-103", "kuboTypeId":"<uuid>" }` | `kubos` |
| `PATCH /kubos/:kuboId/status` | Administrator | `{ "status":"Maintenance" }` | `kubos` |
| `GET /kubos`, `GET /kubos/:kuboId`, `GET /kubos/type/:kuboTypeId` | Authenticated | List filters vary by route | `kubos` |
| `GET /kubos/available` | Authenticated | Query: required `checkIn`, `checkOut`; optional `kuboTypeId` | `kubos` |
| `DELETE /kubos/:kuboId` | Administrator | None | `204 No Content` when there is no assignment history |

Kubo-type prices and other database numerics may be serialized as strings. The `PATCH /kubos/:kuboId` route updates kubo details; change a status through `PATCH /kubos/:kuboId/status`.

### Employees

Employee operations are Administrator-only. The create payload preserves a legacy field name: `passwordHash` is the plaintext initial password sent to the API; the service hashes it before storage. Never log or return that value.

```json
{
  "roleId": "<role-uuid>",
  "firstName": "Metch",
  "lastName": "Amores",
  "username": "mamores",
  "passwordHash": "Secret123!",
  "status": "Active"
}
```

| Method and path | Request body / query | Success payload |
|---|---|---|
| `POST /employees` | Body above (`status` optional) | `employees` |
| `GET /employees` | Query: `page`, `limit`, `role`, `status`, `search` | `employees` |
| `GET /employees/:employeeId` | None | `employees` |
| `PATCH /employees/:employeeId` | Partial `{ "roleId":"<role-uuid>", "firstName":"Metch", "lastName":"Amores", "username":"mamores", "status":"Inactive" }` | `employees` |
| `PATCH /employees/:employeeId/password` | `{ "password":"Secret123!" }` | `employees` |
| `DELETE /employees/:employeeId` | None | `204 No Content` when permitted |

### Reservations and kubo assignments

Create a reservation with at least one assignment. The backend takes the acting Staff employee from the token, generates the reference code, and snapshots the current nightly rate.

```json
{
  "guestId": "<guest-uuid>",
  "bookingSource": "WalkIn",
  "assignments": [
    {
      "kuboId": "<kubo-uuid>",
      "checkInDate": "2026-11-10",
      "checkOutDate": "2026-11-12",
      "scheduledCheckInTime": "14:00",
      "scheduledCheckOutTime": "11:00"
    }
  ]
}
```

| Method and path | Access | Request body / query | Success payload |
|---|---|---|---|
| `POST /reservations` | Staff | Body above; scheduled times optional | `reservations` |
| `GET /reservations` | Authenticated | `page`, `limit`, `status`, `bookingSource`, `search`, `guestId`, `employeeId`, `checkInDate`, `checkOutDate` | `reservations` |
| `GET /reservations/:reservationId` | Authenticated | None | `reservations` |
| `PATCH /reservations/:reservationId` | Staff | Partial `{ "guestId":"<guest-uuid>", "bookingSource":"WalkIn" }` | `reservations` |
| `PATCH /reservations/:reservationId/confirm` | Staff | None | `reservations` |
| `PATCH /reservations/:reservationId/cancel` | Staff | `{ "reason":"Guest requested cancellation" }` | `reservations` |
| `PATCH /reservations/:reservationId/no-show` | Staff | None | `reservations` |
| `DELETE /reservations/:reservationId` | Staff | None; repair-only | `204 No Content` |
| `POST /reservations/:reservationId/kubos` | Staff | `{ "kuboId":"<kubo-uuid>", "checkInDate":"2026-11-10", "checkOutDate":"2026-11-12" }` (optional scheduled times) | `reservedKubos` |
| `GET /reservations/:reservationId/kubos`, `GET /reservations/:reservationId/kubos/:kuboId` | Authenticated | None | `reservedKubos` |
| `PATCH /reservations/:reservationId/kubos/:kuboId` | Staff | At least one of `checkInDate`, `checkOutDate`, `scheduledCheckInTime`, `scheduledCheckOutTime` | `reservedKubos` |
| `DELETE /reservations/:reservationId/kubos/:kuboId` | Staff | None | `204 No Content` where allowed |
| `PATCH /reservations/:reservationId/kubos/:kuboId/check-in` | Staff | None | `reservedKubos` |
| `PATCH /reservations/:reservationId/kubos/:kuboId/check-out` | Staff | None | `reservedKubos` |
| `PATCH /reservations/:reservationId/kubos/:kuboId/early-check-in` | Staff | None | `reservedKubos` |

Reservation totals and balances are derived from assignments, charges, and payments. Do not send or store a client-computed reservation total.

### Payments and refunds

Create a payment at `POST /reservations/:reservationId/payments` with:

```json
{
  "paymentAmount": 5000,
  "paymentType": "Deposit",
  "paymentMethod": "GCash"
}
```

The server sets the transaction type to `Payment`, status to `Pending`, and its timestamp. To refund a completed payment, call `POST /reservations/:reservationId/payments/refund` with:

```json
{
  "originalPaymentId": "<payment-uuid>",
  "paymentAmount": 1000,
  "paymentType": "Deposit",
  "paymentMethod": "GCash"
}
```

| Method and path | Access | Request body / query | Success payload |
|---|---|---|---|
| `GET /payments` | Authenticated | `page`, `limit`, `reservationId`, `employeeId`, `paymentStatus`, `paymentMethod`, `transactionType`, `createdFrom`, `createdTo` | `payments` |
| `GET /payments/:paymentId` | Authenticated | None | `payments` |
| `GET /reservations/:reservationId/payments` | Authenticated | None | `payments` |
| `POST /reservations/:reservationId/payments` | Staff | Payment body above | `payments` |
| `POST /reservations/:reservationId/payments/refund` | Staff | Refund body above | `payments` |
| `PATCH /payments/:paymentId/status` | Staff | `{ "status":"Completed" }` (only permitted transitions are accepted) | `payments` |
| `DELETE /payments/:paymentId` | Administrator | None; development/repair cleanup only | `204 No Content` |

Overpayment is rejected. Refunds must refer to a completed payment for the same reservation and cannot exceed net paid.

### Additional-charge catalog, applied charges, and custom requests

Catalog creation:

```json
{
  "chargeType": "ExtraBed",
  "name": "Extra Bed",
  "description": "Rollaway bed per night",
  "unitPrice": 500,
  "isActive": true
}
```

| Method and path | Access | Request body / query | Success payload |
|---|---|---|---|
| `GET /additional-charge-catalog` | Authenticated | `page`, `limit`, `search`, `activeOnly` (defaults to true; set false to include inactive items) | `additionalChargeCatalog` |
| `GET /additional-charge-catalog/:catalogId` | Authenticated | None | `additionalChargeCatalog` |
| `POST /additional-charge-catalog` | Administrator | Catalog body above | `additionalChargeCatalog` |
| `PATCH /additional-charge-catalog/:catalogId` or `PATCH /additional-charge-catalog/:catalogId/status` | Administrator | Any supported subset of catalog body fields | `additionalChargeCatalog` |
| `DELETE /additional-charge-catalog/:catalogId` | Administrator | None; item must be unused | `204 No Content` |
| `POST /reservations/:reservationId/charges` | Staff | `{ "catalogId":"<catalog-uuid>", "quantity":2 }` (`quantity` optional) | `additionalCharges` |
| `GET /reservations/:reservationId/charges` | Authenticated | None | `additionalCharges` |
| `GET /additional-charges`, `GET /additional-charges/:chargeId` | Authenticated | List filters per additional-charge contract | `additionalCharges` |
| `DELETE /additional-charges/:chargeId` | Staff | None; blocked after settlement | `204 No Content` |
| `POST /additional-charges/:chargeId/corrections` | Administrator | `{ "chargeType":"Damage", "quantity":1, "unitAmount":250, "reason":"Additional damage assessment" }` | `additionalCharges` |
| `POST /reservations/:reservationId/charge-requests` | Staff | `{ "description":"Airport transfer", "quantity":1, "proposedUnitAmount":800 }` | `additionalChargeRequests` |
| `GET /additional-charge-requests`, `GET /additional-charge-requests/:requestId` | Authenticated | List filters per additional-charge contract | `additionalChargeRequests` |
| `PATCH /additional-charge-requests/:requestId/approve` | Administrator | `{}` or `{ "approvedUnitAmount":900, "reason":"Updated rate" }`; reason required when adjusting price | `additionalChargeRequests` |
| `PATCH /additional-charge-requests/:requestId/reject` | Administrator | `{ "reason":"Not provided" }` | `additionalChargeRequests` |
| `PATCH /additional-charge-requests/:requestId/withdraw` | Requesting Staff member | None | `additionalChargeRequests` |

Used catalog entries cannot be deleted; deactivate them instead. Custom requests do not change a balance until approved. Administrator corrections are additive; reductions and Adjustment/Reversal balance effects are not implemented.

### Audit logs

Audit log routes are Administrator-only and read-only. All writes are generated by the business-operation routes.

| Method and path | Query / body | Success payload |
|---|---|---|
| `GET /audit-logs` | Query: `page`, `limit`, `employeeId`, `action`, `entityType`, `entityId`, `createdFrom`, `createdTo` | `auditLogs` |
| `GET /audit-logs/:auditId` | None | `auditLogs` |
| `GET /audit-logs/history/:entityType/:entityId` | Optional `limit`, `offset` per contract | `auditLogs` |
| `GET /audit-logs/employees/:employeeId/audit-logs` | Pagination and filters per contract | `auditLogs` |

## Contract references

See the backend module contracts for full schemas, filter constraints, enum values, response examples, status codes, and database business-rule errors:

- [Auth](../../backend/src/modules/auth/API_CONTRACT.md)
- [Roles](../../backend/src/modules/role/API_CONTRACT.md)
- [Guests](../../backend/src/modules/guest/API_CONTRACT.md)
- [Employees](../../backend/src/modules/employee/API_CONTRACT.md)
- [Kubo types](../../backend/src/modules/room_kubo-type/API_CONTRACT.md)
- [Kubos](../../backend/src/modules/room_kubo/API_CONTRACT.md)
- [Reservations](../../backend/src/modules/reservation/API_CONTRACT.md)
- [Kubo assignments](../../backend/src/modules/reserved-room_kubo/API_CONTRACT.md)
- [Payments and additional charges](../../backend/src/modules/payment/API_CONTRACT.md)
- [Additional-charge catalog and requests](../../backend/src/modules/additional-charges/API_CONTRACT.md)
- [Audit logs](../../backend/src/modules/audit-logs/API_CONTRACT.md)
