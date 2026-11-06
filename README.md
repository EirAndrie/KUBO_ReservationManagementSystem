# KUBO Reservation Management System

A reservation management system for KUBO Beach Resort, built with PostgreSQL, Express, React, and Node.js (PERN) in TypeScript.

> **Project architecture:** [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) explains every folder in plain language, with comments, a request walkthrough, and a "where to find things" table.

The backend manages employees and roles, guests, kubo types and kubos, reservations and kubo assignments, additional charges, payments and refunds, authentication, and an append-only audit log.

| Part        | Status                                                                                |
| ----------- | ------------------------------------------------------------------------------------- |
| `backend/`  | Runnable Express API. Core modules, JWT authentication, RBAC, and audit logging work. |
| `frontend/` | Vite + React scaffold only. UI planning lives in `frontend/docs/`.                    |
| `docs/`     | Business rules, architecture, database, API, and validation documentation.            |
| `postman/`  | Postman collection with read-only checks and self-cleaning write tests.               |

See [`docs/development-progress.md`](docs/development-progress.md) for per-module status.

---

## Tech Stack

| Layer           | Technology                                 |
| --------------- | ------------------------------------------ |
| Database        | PostgreSQL 15+ (functions and procedures)  |
| Database access | `pg` driver, parameterized queries, no ORM |
| Backend         | Node.js 22, Express 5, TypeScript          |
| Validation      | Zod v4                                     |
| Authentication  | JWT (`jsonwebtoken`), `bcrypt`             |
| Logging         | `winston`                                  |
| Frontend        | React 19, Vite (scaffold)                  |
| API testing     | Postman collection (v3 YAML), Postman CLI  |
| CI              | GitHub Actions: `npm ci`, typecheck, build |

> The project does **not** use an ORM. Drizzle ORM, `drizzle-kit`, and `drizzle-zod` are not used. The `db:generate` and `db:migrate` npm scripts are leftovers; do not run them.

---

## Quick Start

### Prerequisites

- Node.js 22 (the version CI uses)
- npm 10+
- PostgreSQL 15+
- A KUBO database that already contains the base `kubo` schema (see [Database](#database))

### 1. Install

```bash
git clone https://github.com/EirAndrie/KUBO_ReservationManagementSystem.git
cd KUBO_ReservationManagementSystem/backend
npm ci
```

### 2. Configure

Copy `backend/example.env` to `backend/.env` and fill it in:

```env
PORT=8080
NODE_ENV=development
FR_ORIGIN=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<your-password>
DB_NAME=<your-database>

JWT_SECRET=<random string, at least 32 characters>
JWT_EXPIRES_IN=8h
```

| Variable                                                      | Required | Notes                                                                |
| ------------------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| `PORT`                                                        | Yes      | API port.                                                            |
| `NODE_ENV`                                                    | Yes      | `development` or `production`.                                       |
| `FR_ORIGIN`                                                   | Yes      | Allowed CORS origin for the frontend.                                |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | Yes      | These are what the connection pool actually reads.                   |
| `JWT_SECRET`                                                  | Yes      | Must be at least 32 characters in production.                        |
| `JWT_EXPIRES_IN`                                              | No       | Token lifetime. Defaults to `8h`.                                    |
| `DB_URL`, `PASSWORD_LENGTH`                                   | No       | Declared but unused. `DB_URL` does **not** configure the connection. |

Never commit `.env` files or credentials.

### 3. Run

Run commands from `backend/`, because `.env` and `logs/` are resolved relative to the working directory.

```bash
npm run dev         # nodemon + ts-node src/server.ts
npm run typecheck   # tsc --noEmit (required by CI)
npm run build       # tsc -> dist/
```

On startup the server connects to PostgreSQL, applies pending migrations, and then listens on `PORT`. In development, `GET /` returns `API running successfully...`.

> **Production build caveat:** `npm run build` does not copy `src/migrations/*.sql` into `dist/`. Copy them to `dist/migrations/` before running `node dist/server.js`, or startup will fail.

---

## Database

PostgreSQL is accessed only through `pg`, almost always by calling stored functions in the `kubo` and `kubo_*_management` schemas.

### Migrations

`src/utils/migrate.ts` runs every `backend/src/migrations/*.sql` file in filename order at startup and records applied files in a `schema_migrations` table. Each file runs once.

The migrations **harden an existing database**. They add functions, constraints, the charge catalog and request tables, authentication, and audit infrastructure, but they do not create every base table (such as `employee`, `guest`, `reservation`, or `payment`). An empty database needs the team's base `kubo` schema loaded first. The additional-charge migration also expects the `kubo_additional_charges_management` schema to exist.

To add a migration, create a new file named `YYYYMMDD_short_description.sql`. Do not edit migrations that have already been applied.

### Rules

- Keep SQL inside module repositories.
- Always use parameterized queries:

  ```ts
  await db.query("SELECT * FROM kubo.get_guest_by_id($1)", [guestId]);
  ```

- Use PostgreSQL functions or procedures for multi-table or atomic operations.
- Reservation totals, charges, net paid, and balances are derived, never stored (BR-040).

See [`docs/database.md`](docs/database.md) and [`docs/business_rules.md`](docs/business_rules.md).

---

## API

All routes are mounted under:

```text
/KUBO_Resort/Management-System/v0.0.1
```

`backend/src/modules/index.ts` is the source of truth for mounted routes.

| Prefix                                                        | Purpose                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `/auth`                                                       | `POST /login` (public), `POST /logout`, `GET /me`                         |
| `/roles`                                                      | Role management                                                           |
| `/employees`                                                  | Employee management (Administrator only)                                  |
| `/guests`                                                     | Guest profiles                                                            |
| `/kubo-types`                                                 | Kubo types and rates                                                      |
| `/kubos`                                                      | Kubos, status, and availability                                           |
| `/reservations`                                               | Reservations and lifecycle (confirm, check-in, checkout, cancel, no-show) |
| `/reservations/:reservationId/kubos`                          | Kubo assignments and per-kubo check-in/check-out                          |
| `/reservations/:reservationId/payments`, `/payments`          | Payments, status transitions, and refunds                                 |
| `/additional-charge-catalog`                                  | Charge catalog (Administrator writes)                                     |
| `/additional-charges`, `/reservations/:reservationId/charges` | Applied charges                                                           |
| `/additional-charge-requests`                                 | Custom charge requests and approval                                       |
| `/audit-logs`                                                 | Audit log reads (Administrator only)                                      |

### Authentication

1. Call `POST /auth/login` with `{ "username": "...", "password": "..." }`.
2. Send the returned token as `Authorization: Bearer <token>` on every other request.
3. Routes enforce the `Administrator` or `Staff` role where required.

The acting employee always comes from the token; a client-supplied `employeeId` is ignored. JWTs are stateless, so `POST /auth/logout` records an audit entry but does not revoke the token.

Response envelopes differ by module (for example `payments`, `guests`, or `data`), and list endpoints generally include `count`. Check the module you are calling; [`docs/api.md`](docs/api.md) describes conventions but is not an exact contract.

---

## Testing

There is no automated unit or integration test suite. Verification uses:

1. `npm run typecheck` and `npm run build`, which CI also runs on pushes and pull requests to `main`.
2. The Postman collection in `postman/collections/KUBO_ManagementSystem`.

### Postman collection

- A shared login script fetches tokens using credentials passed as variables. No credentials are stored in the repository.
- `postman/environments/local.environment.yaml` lists the variables: `base_url`, `admin_username`, `admin_password`, `staff_username`, and `staff_password`.
- Read-only requests can run against your normal development database.
- The `Write Tests (test DB only)` folder creates and cleans up its own data. It is skipped unless `allow_writes=true` is set. Run it only against a separate test database.

Example (PowerShell, from the repository root):

```powershell
postman collection run postman/collections/KUBO_ManagementSystem `
  --env-var base_url=http://localhost:8080/KUBO_Resort/Management-System/v0.0.1 `
  --env-var admin_username=<admin> --env-var admin_password=<password> `
  --env-var staff_username=<staff> --env-var staff_password=<password>
```

To run the write tests, start a second backend against a copy of the database, then add `--env-var allow_writes=true` and point `base_url` at port `8081`:

```powershell
cd backend
$env:DB_NAME = "kubo_beach_resort_system_test"; $env:PORT = "8081"; npx ts-node src/server.ts
```

---

## Project Structure

For a folder-by-folder explanation with comments, see [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md).

```text
.
├── AGENTS.md                 # Implementation state and rules for coding agents
├── backend/
│   ├── example.env
│   └── src/
│       ├── server.ts         # Startup: env checks, CORS, routes, migrations
│       ├── config/           # env, auth config, shared pg pool (connectDB.ts)
│       ├── migrations/       # Ordered SQL migrations
│       ├── utils/            # http, pagination, logger, migrate, auth helpers
│       └── modules/
│           ├── index.ts      # Route mounting
│           ├── auth/
│           ├── role/
│           ├── employee/
│           ├── guest/
│           ├── room_kubo-type/
│           ├── room_kubo/
│           ├── reservation/
│           ├── reserved-room_kubo/
│           ├── additional-charges/
│           ├── payment/
│           └── audit-logs/
├── docs/                     # Business rules, architecture, API, ERD, flowcharts
├── frontend/                 # Vite + React scaffold and UI planning docs
└── postman/                  # Postman collection, environment template, globals
```

Each module follows this layout:

```text
modules/<feature>/
├── <feature>.routes.ts
├── <feature>.controllers.ts
├── <feature>.services.ts
└── repository/
    ├── <feature>.repository.ts
    └── <feature>.schema.ts      # Zod schemas
```

### Request flow

```text
Route -> Controller -> Service -> Repository -> PostgreSQL function -> Tables
```

| Layer      | Responsibility                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Route      | Mounts endpoints and applies auth/role middleware, `validateBody(...)`, and `requireUuidParam(...)`.        |
| Controller | Reads the request, validates query values, calls the service, and maps errors with `handleControllerError`. |
| Service    | Business logic. Throws `AppError(status, message)`. No SQL.                                                 |
| Repository | Parameterized SQL through the shared `db` pool. Maps rows to results.                                       |
| PostgreSQL | Constraints, stored functions, transactions, and audit writes.                                              |

`mapDatabaseError` in `src/utils/http.ts` converts PostgreSQL error codes to HTTP statuses (for example `23505` -> 400, `23503` -> 409, `P0002` -> 404, `42501` -> 403).

---

## Documentation

| Document                                                             | Purpose                                                  |
| -------------------------------------------------------------------- | -------------------------------------------------------- |
| [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md)             | Plain-language guide to every folder (start here)        |
| [`AGENTS.md`](AGENTS.md)                                             | Current implementation state and rules for agents        |
| [`docs/business_rules.md`](docs/business_rules.md)                   | Authoritative domain specification and known gaps        |
| [`docs/development-progress.md`](docs/development-progress.md)       | Per-entity implementation status                         |
| [`docs/architecture.md`](docs/architecture.md)                       | Module structure and layer responsibilities              |
| [`docs/database.md`](docs/database.md)                               | PostgreSQL, repositories, functions, and transactions    |
| [`docs/api.md`](docs/api.md)                                         | REST API conventions                                     |
| [`docs/validation.md`](docs/validation.md)                           | Zod and validation rules                                 |
| [`docs/coding-standards.md`](docs/coding-standards.md)               | TypeScript, naming, errors, and security                 |
| [`docs/system_flowcharts.md`](docs/system_flowcharts.md)             | System flowcharts                                        |
| [`docs/audit-logging-checklist.md`](docs/audit-logging-checklist.md) | Audit coverage checklist                                 |
| `docs/ERD.drawio`, `docs/ERD&Flowcharts.drawio`                      | ERD and flowchart diagrams (open with draw.io)           |
| [`frontend/docs/`](frontend/docs)                                    | Frontend architecture, UI specification, API integration |

Some `docs/*.md` files describe an older target layout (for example an `/api` base path or nested `repository/` folders). When they disagree with the code, the code and `AGENTS.md` take precedence.

---

## Development Workflow

1. Read `AGENTS.md`, then the relevant `docs/*.md` file and `docs/business_rules.md`.
2. Inspect the affected module and match its patterns.
3. Put each change in the correct layer. Keep SQL in repositories only.
4. Add JSDoc for major features and non-obvious logic: purpose, business rules, side effects, transactions, security, and failure behavior.
5. Run `npm run typecheck` (and `npm run build` when build output matters).
6. Check route mounting and response shapes for API changes, ideally with the Postman collection.

### Commits and pull requests

- Branch from `main` (for example `feat/payment-adjustments`).
- Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): short description`, such as `fix(payment): block refunds above net paid`.
- Open a pull request against `main`. CI must pass.

### Development rules

- No ORM. Use `pg` with parameterized queries.
- Validate all external input with Zod before business logic.
- Do not invent database fields, relationships, endpoints, or business rules.
- Do not bypass services or repositories.
- Prefer simple implementations over new abstractions or dependencies.
- Keep changes focused; do not modify unrelated files.

---

## Known Limitations

- Adjustment/Reversal payment effects and Administrator charge reductions are not implemented (gap G-07).
- Overpayments are blocked; overpayment approval (BR-053) is not implemented.
- Refunds are linked to their original payment through the audit description, because the schema has no `original_payment_id` column.
- The frontend is a scaffold with no application screens yet.
- `npm run build` does not copy migrations into `dist/`.

---

## License

This project is developed for academic purposes.
