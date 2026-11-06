# Auth Module — API Contract

Authentication and session endpoints for the Kubo Reservation Management System.

- **Base path:** `API_BASE_PATH` (default `/api`; this repo uses `/KUBO_Resort/Management-System/v0.0.1`)
- **Module mount:** `/auth`
- **Source files:** `auth.routes.ts`, `auth.controllers.ts`, `auth.services.ts`, `auth.middleware.ts`, `repository/auth.schema.ts`, `repository/auth.repository.ts`
- **Authentication:** `POST /login` is public. `POST /logout` and `GET /me` require a Bearer access token.

> This document describes the API as implemented. Response keys are shown exactly
> as they appear on the wire.

---

## 1. Common conventions

### 1.1 Request headers

| Header | Required | Value |
|---|---|---|
| `Content-Type` | For requests with a body | `application/json` |
| `Authorization` | Protected endpoints only | `Bearer <accessToken>` |

The token is issued by `POST /auth/login`. Tokens are signed JWTs with:

| Claim | Value |
|---|---|
| `employeeId` | Authenticated employee UUID |
| `roleId` | Employee role UUID |
| `roleName` | Stored role name |
| `sub` | Same as `employeeId` |
| `iss` | `kubo-api` |
| `aud` | `kubo-client` |
| `exp` | Current time + `JWT_EXPIRES_IN` (default `8h`) |

The employee and role are re-read from the database on every authenticated request,
so role changes and deactivation take effect immediately. The JWT role claims are
not trusted as the sole authorization source.

### 1.2 Success envelope

Every successful auth response uses:

```json
{
  "success": true,
  "message": "Human-readable result"
}
```

Endpoint-specific fields are added alongside `success` and `message`. There is no
`data` wrapper.

### 1.3 Error envelope

Every handled error uses:

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

No stack trace, SQL statement, password hash, or raw PostgreSQL error is returned.

### 1.4 Authentication failure behavior

`authenticate` middleware runs before `POST /logout` and `GET /me`:

| Condition | Status | Message |
|---|---:|---|
| `Authorization` header missing | `401` | `Authentication required` |
| Scheme is not Bearer, or token is missing | `401` | `Authentication required` |
| Token expired | `401` | `Token has expired` |
| Token signature/claims invalid | `401` | `Invalid token` |
| Token employee no longer exists | `401` | `Authentication required` |
| Employee status is not `Active` | `403` | `Account is not active` |
| Unexpected authentication/database failure | `500` | `Authentication failed` |

### 1.5 Validation behavior

Request bodies are validated with Zod before the controller runs. A validation
failure returns `400` with all issues joined into one `message`, for example:

```json
{
  "success": false,
  "message": "username: Username is required; password: Password is required"
}
```

### 1.6 Database error mapping

Auth repository calls translate PostgreSQL errors through the shared mapper:

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
| `POST` | `/auth/login` | Public | Verify credentials and issue an access token |
| `POST` | `/auth/logout` | Authenticated | Record a logout audit event |
| `GET` | `/auth/me` | Authenticated | Return the current employee profile |

---

## 3. `POST /auth/login`

Verify an employee username/password and issue a Bearer token.

### 3.1 Access

Public. No `Authorization` header is required.

### 3.2 Request body

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `username` | string | Yes | Trimmed; 1–100 characters |
| `password` | string | Yes | 1–255 characters |

Unknown fields are stripped by Zod.

```json
{
  "username": "msantos",
  "password": "Secret123!"
}
```

### 3.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Login successful` |
| `accessToken` | string | No | Signed JWT |
| `tokenType` | string | No | Always `Bearer` |
| `employee` | object | No | Safe employee profile; never includes `passwordHash` |
| `employee.employeeId` | string (UUID) | No | |
| `employee.roleId` | string (UUID) | No | |
| `employee.roleName` | string | No | Stored role name |
| `employee.firstName` | string | No | |
| `employee.lastName` | string | No | |
| `employee.username` | string | No | |
| `employee.status` | string | No | `Active` on successful login |

```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "employee": {
    "employeeId": "5efe3900-8a3c-4053-87f8-f6588257c7d5",
    "roleId": "0d4a1e6e-5f2b-4f22-9f7a-3c7f6a1b2c34",
    "roleName": "Administrator",
    "firstName": "Maria",
    "lastName": "Santos",
    "username": "msantos",
    "status": "Active"
  }
}
```

### 3.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Body fails Zod validation | `400` | Validation detail |
| Username does not exist | `401` | `Invalid username or password` |
| Password does not match | `401` | `Invalid username or password` |
| Credentials valid but status is not `Active` | `403` | `Account is not active` |
| Login audit write fails | `500` | Database/fallback error |
| Unexpected lookup failure | `500` | Database/fallback error |

Behavior notes:

- Unknown usernames are compared against a fixed dummy bcrypt hash so response
  timing does not reveal whether an account exists.
- A successful login writes an audit row (`action = Login`, `entityType = employee`,
  `entityId = employeeId`) before the token is returned.
- Audit writing is fail-closed: if the audit row cannot be written, login fails and
  no token is returned.
- There is no lockout, rate-limit, refresh-token, or token-revocation behavior in
  this module.

### 3.5 Side effects

- Inserts one row into `kubo.audit_log`.
- No session is stored server-side.

---

## 4. `POST /auth/logout`

Record a logout audit event for the authenticated employee.

### 4.1 Access

Authenticated. Requires `Authorization: Bearer <token>`.

### 4.2 Request body

None. A body is ignored.

### 4.3 Success response — `204 No Content`

No response body.

### 4.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Missing/invalid/expired token | `401` | See §1.4 |
| Employee not active | `403` | `Account is not active` |
| Audit write fails | `500` | Database/fallback error |

Behavior notes:

- JWTs are stateless. Logout does **not** invalidate or revoke the presented token;
  it remains usable until expiry.
- The acting employee is always `req.auth.employeeId`; clients cannot specify a
  different employee.

### 4.5 Side effects

- Inserts one audit row (`action = Logout`, `entityType = employee`,
  `entityId = authenticated employeeId`).

---

## 5. `GET /auth/me`

Return the current employee profile refreshed from the database.

### 5.1 Access

Authenticated. Requires `Authorization: Bearer <token>`.

### 5.2 Request parameters

None.

### 5.3 Success response — `200 OK`

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `success` | boolean | No | Always `true` |
| `message` | string | No | `Successfully fetched current employee` |
| `employee` | object | No | Same safe profile shape as login |
| `employee.employeeId` | string (UUID) | No | |
| `employee.roleId` | string (UUID) | No | |
| `employee.roleName` | string | No | |
| `employee.firstName` | string | No | |
| `employee.lastName` | string | No | |
| `employee.username` | string | No | |
| `employee.status` | string | No | |

```json
{
  "success": true,
  "message": "Successfully fetched current employee",
  "employee": {
    "employeeId": "5efe3900-8a3c-4053-87f8-f6588257c7d5",
    "roleId": "0d4a1e6e-5f2b-4f22-9f7a-3c7f6a1b2c34",
    "roleName": "Administrator",
    "firstName": "Maria",
    "lastName": "Santos",
    "username": "msantos",
    "status": "Active"
  }
}
```

### 5.4 Business rules and failures

| Condition | Status | Message |
|---|---:|---|
| Missing/invalid/expired token | `401` | See §1.4 |
| Employee not active | `403` | `Account is not active` |
| Employee deleted between middleware and service | `404` | `Employee not found` |
| Unexpected lookup failure | `500` | Database/fallback error |

### 5.5 Side effects

- None. `GET /me` does not write an audit row.

---

## 6. Role values

Auth does not restrict by role. Authorization helpers use these business role names:

| Business role | Matching rule |
|---|---|
| `Administrator` | Stored `role_name` equals `administrator` (exact, lowercase) |
| `Staff` | Stored `role_name` equals `staff` (exact, lowercase) |

An authenticated employee whose status is not `Active` is rejected with `403` before
any role check.

---

## 7. Known contract quirks

- Auth responses use **camelCase** keys (`employeeId`, `accessToken`), unlike the
  database-backed modules, which return snake_case rows.
- `POST /logout` returns `204` but the controller calls `res.status(204).json()`;
  clients must treat the response as an empty `204`.
- Logout is audit-only and does not revoke the JWT.
- `GET /auth/me` can return `404` even after successful authentication if the
  employee row is removed between the middleware lookup and the service lookup.
- Login failures always use the same `401` message for unknown usernames and wrong
  passwords. Do not use the message to distinguish the two cases.
- The token lifetime is deployment-configured through `JWT_EXPIRES_IN` (default
  `8h`); the contract does not guarantee a fixed expiry.
