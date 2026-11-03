# Architecture

## Core Architecture

The project follows a **module‑based architecture**. Each module represents a domain or major resource.

```text
module/
├── feature1/
│   ├── repository/
│   │   ├── schemas/
│   │   ├── procedures/
│   │   ├── validations/
│   │   ├── queries/
│   │   └── ...
│   ├── feature1.controller.ts
│   ├── feature1.service.ts
│   └── feature1.routes.ts
│
├── feature2/
│   ├── repository/ …
│   ├── feature2.controller.ts
│   ├── feature2.service.ts
│   └── feature2.routes.ts
│
└── feature3/ …
```

**Do not** create a global structure such as `src/controllers`, `src/services`, etc.; domain‑specific database logic stays inside its module.

## Layer Responsibilities

```
Route → Controller → Service → Repository → PostgreSQL Function / Procedure → PostgreSQL
```

- **Route** – defines HTTP method, URL, middleware and the controller.
- **Controller** – handles HTTP concerns, calls services, returns responses, forwards errors.
- **Service** – contains application‑level business logic, coordinates repositories.
- **Repository** – talks to PostgreSQL via functions/procedures, maps results.
- **PostgreSQL** – stores data, enforces constraints, runs transactions.

## Architectural Boundary

Maintain a strict dependency direction:

```
Routes → Controller → Service → Repository → PostgreSQL
```

Never reverse this direction. For example, repositories must not import controllers or services, and controllers must never execute SQL directly.

## Authentication and Authorization

- Identity is a signed HS256 JWT issued by `POST /auth/login`. Clients send it as
  `Authorization: Bearer <token>`.
- The `authenticate` middleware (mounted globally in `src/modules/index.ts`, after the
  `/auth` routes) verifies the token and re-reads the employee + role from the database
  on every request, so status and role changes take effect immediately.
- The `authorizeRoles(...)` middleware enforces role-based access at the route level.
  Role names are matched case-insensitively (`ADMIN`/`Administrator` and `STAFF`/`Staff`).
- The acting employee for audited mutations is always `req.auth.employeeId`; clients
  can no longer supply an `employeeId` to act on another employee's behalf.

## Audit Logging

- Every significant action is recorded in the append-only `kubo.audit_log` table
  (BR-067 through BR-071, BR-078).
- Mutations write their audit row inside the same PostgreSQL routine/transaction as the
  data change, so a failed mutation rolls its audit row back (BR-071).
- The acting employee is always `req.auth.employeeId`, threaded
  `controller → service → repository → routine`. Clients cannot supply an actor.
- Login and logout have no database mutation routine, so the auth service calls the
  application-level `writeAuditLog` helper in the audit repository, which delegates to
  `kubo_audit_management.write_audit_log`.
- Audit values are built with explicit JSON helpers; `password_hash` is never logged
  (BR-070) and `guest.id_number` is masked.
- Deletes write their audit row before the delete so the actor still resolves.
- The read API (`GET /audit-logs*`) is Administrator-only and reads through
  `kubo.search_audit_logs`, `kubo.get_audit_log_by_id`, and `kubo.get_audit_history`.

### Audit entity types

| `entity_type` | Entity |
|---|---|
| `reservation` | reservation and reserved-kubo assignment/check-in events |
| `role` | role |
| `employee` | employee |
| `guest` | guest |
| `kubo_type` | kubo type |
| `kubo` | kubo |
| `payment` | payment |
| `additional_charge` | applied charge |
| `additional_charge_catalog` | catalog item |
| `additional_charge_request` | custom charge request |

## Additional-Charge Catalog and Requests

The additional-charge module now contains three conceptual areas:

- **Catalog management** — Administrator CRUD for predefined charges and prices.
- **Applied charges** — Staff selection of catalog items or approved custom charges.
- **Custom requests** — Staff submission and Administrator approval/rejection/adjustment.

All three flow through the same layered architecture:

```text
Routes → Controller → Service → Repository → PostgreSQL routines
```

Applied charges and custom requests must be written atomically with their audit rows
once auditing is wired. The catalog remains configuration data; applied charges store a
snapshot so later catalog changes do not rewrite history.

## Final Architecture Diagram

```
                    ┌──────────────────────┐
                    │       Express        │
                    └──────────┬───────────┘
                               │
                         HTTP Request
                               │
                               ▼
                    ┌──────────────────────┐
                    │        Routes        │
                    └──────────└───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │      Controller      │
                    └──────────└───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │       Service        │
                    └──────────└───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │      Repository      │
                    │  schemas, validations,
                    │  procedures, queries │
                    └──────────└───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     PostgreSQL       │
                    │  Functions, Procedures,
                    │  Constraints, Transactions
                    └──────────────────────┘
```

Each feature follows the same structure:

```text
feature/
├── repository/
│   ├── schemas/
│   ├── procedures/
│   ├── validations/
│   ├── queries/
│   └── feature.repository.ts
├── feature.controller.ts
├── feature.service.ts
└── feature.routes.ts
```
