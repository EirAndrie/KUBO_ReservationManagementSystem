# KUBO Reservation Management System

A reservation management system for KUBO Beach Resort, built with PostgreSQL, Express, React, and Node.js (PERN) in TypeScript.

> **Project architecture:** [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) explains every folder in plain language, with comments, a request walkthrough, and a "where to find things" table.

The backend manages employees and roles, guests, kubo types and kubos, reservations and kubo assignments, additional charges, payments, refunds and charge adjustments, authentication, and an append-only audit log. The frontend gives staff and administrators screens for these workflows.

| Part        | Status                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| `backend/`  | Runnable Express API, deployed on Render. Core modules, JWT authentication, RBAC, and audit logging work.     |
| `frontend/` | React 19 + Vite app, deployed on Vercel: login, dashboards, guests, reservations, kubos, kubo types, employees, payments, audit logs, and the charge catalog. |
| `docs/`     | Business rules, architecture, database, API, validation, and Infisical setup documentation.                   |
| `postman/`  | Postman collection with read-only checks and self-cleaning write tests.                                       |

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
| Frontend        | React 19, Vite, TanStack Query, Ant Design, React Hook Form |
| Secrets         | Infisical (shared config), local `.env` for `DB_*` |
| Hosting         | Backend on Render, frontend on Vercel      |
| API testing     | Postman collection (v3 YAML), Postman CLI  |
| CI              | GitHub Actions: backend (typecheck, build), frontend (typecheck, lint, build), keep-alive ping |

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
cd KUBO_ReservationManagementSystem
(cd backend && npm ci)
(cd frontend && npm ci)
```

### 2. Configure

**Team setup (recommended): Infisical.** Shared values (`PORT`, `API_BASE_PATH`, `FR_ORIGIN`, `JWT_*`, `VITE_API_BASE_URL`, and so on) live in the team's Infisical project. Install the CLI, run `infisical login`, and create `backend/.env` with only your machine-specific `DB_*` values:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<your-password>
DB_NAME=<your-database>
```

Full guide: [`docs/infisical.md`](docs/infisical.md).

**Without Infisical.** Copy `backend/example.env` to `backend/.env` and fill in every value. For the frontend, copy `frontend/.env.example` to `frontend/.env`.

```env
PORT=8080
API_BASE_PATH=/KUBO_Resort/Management-System/v0.0.1
NODE_ENV=development
SERVE_FRONTEND=true
FR_ORIGIN=http://localhost:3000

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
| `API_BASE_PATH`                                               | No       | Mount prefix for every API route. Defaults to `/api`; this project uses `/KUBO_Resort/Management-System/v0.0.1`. Must start with `/` and have no trailing slash. |
| `NODE_ENV`                                                    | Yes      | `development` or `production`.                                       |
| `SERVE_FRONTEND`                                              | No       | Serve `frontend/dist` in production. Defaults to `true`; set to `false` when the frontend is hosted separately (for example, on Vercel). |
| `FR_ORIGIN`                                                   | Yes      | Allowed CORS origin for the frontend.                                |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | Yes      | These are what the connection pool actually reads.                   |
| `JWT_SECRET`                                                  | Yes      | Must be at least 32 characters in production.                        |
| `JWT_EXPIRES_IN`                                              | No       | Token lifetime. Defaults to `8h`.                                    |
| `DB_URL`, `PASSWORD_LENGTH`                                   | No       | Declared but unused. `DB_URL` does **not** configure the connection. |

Never commit `.env` files or credentials.

### 3. Run

Run backend commands from `backend/`, because `.env` and `logs/` are resolved relative to the working directory.

```bash
# backend (API on PORT, default 8080)
cd backend
infisical run --env=dev -- npm run dev   # or: npm run dev (all values in backend/.env)
npm run typecheck                        # tsc --noEmit (required by CI)
npm run build                            # tsc -> dist/, then copies migrations to dist/migrations

# frontend (Vite on http://localhost:3000)
cd frontend
infisical run --env=dev -- npm run dev   # or: npm run dev (VITE_API_BASE_URL in frontend/.env)
npm run typecheck && npm run lint && npm run build
```

On Windows, run `infisical` from PowerShell or CMD; see the troubleshooting table in [`docs/infisical.md`](docs/infisical.md). The backend's `FR_ORIGIN` must match the frontend origin (`http://localhost:3000`) or the browser blocks API calls with a CORS error. `VITE_API_BASE_URL` must be `http://localhost:<PORT><API_BASE_PATH>`.

On startup the server connects to PostgreSQL, applies pending migrations, and then listens on `PORT`. In development, `GET /` returns `API running successfully...`.

The `postbuild` script copies `src/migrations` into `dist/migrations`, so `npm run build` followed by `node dist/server.js` (`npm start`) works without extra steps.

> **Serving the frontend in production:** when `NODE_ENV=production` and
> `SERVE_FRONTEND=true` (the default), the backend serves the built SPA from
> `frontend/dist` and falls back to `index.html` for client routes. Build the
> frontend first (`cd frontend && npm run build`); startup fails with a clear error
> when `frontend/dist/index.html` is missing. Set `SERVE_FRONTEND=false` when the
> frontend is hosted separately (for example, on Vercel): the backend then runs
> API-only and does not require `frontend/dist`. Unknown routes under
> `API_BASE_PATH` return a JSON `404` in both modes.

---

## Database

PostgreSQL is accessed only through `pg`, almost always by calling stored functions in the `kubo` and `kubo_*_management` schemas.

### Migrations

`src/utils/migrate.ts` runs every `backend/src/migrations/*.sql` file in filename order at startup and records applied files in a `schema_migrations` table. Each file runs once.

The migrations **harden an existing database**. They add functions, constraints, the charge catalog and request tables, authentication, and audit infrastructure, but they do not create every base table (such as `employee`, `guest`, `reservation`, or `payment`). An empty database needs the team's base `kubo` schema loaded first. The additional-charge migration also expects the `kubo_additional_charges_management` schema to exist.

To add a migration, create a new file named `YYYYMMDD_short_description.sql`. Do not edit migrations that have already been applied.

### Sample data

After migrations have applied, seed a development database with two demo accounts,
four kubo types, eight kubos, and six catalog items:

```bash
cd backend
npm run db:seed
```

The script is additive and idempotent: it inserts only missing rows, never overwrites
existing data, and reports what it inserted or skipped.

| Account | Password    | Role            |
| ------- | ----------- | --------------- |
| `admin` | `Admin@123` | `administrator` |
| `staff` | `Staff@123` | `staff`         |

The sample `admin` account is skipped when another active Administrator already exists
(BR-006). Deactivate the existing administrator and re-run if you need the demo
account.

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

All routes are mounted under the path in `API_BASE_PATH` (default `/api`). This
project's `backend/.env` uses:

```text
/KUBO_Resort/Management-System/v0.0.1
```

The frontend's `VITE_API_BASE_URL` must include the same base path. `backend/src/modules/index.ts`
is the source of truth for mounted routes.

| Prefix                                                        | Purpose                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `/health`                                                     | Public health check (`SELECT 1`, 5 s limit): `200` when the database is up, `503` JSON when it is not; pinged every 5 minutes by the keep-alive workflow |
| `/auth`                                                       | `POST /login` (public), `POST /logout`, `GET /me`                         |
| `/roles`                                                      | Role management                                                           |
| `/employees`                                                  | Employee management (Administrator only)                                  |
| `/guests`                                                     | Guest profiles                                                            |
| `/kubo-types`                                                 | Kubo types and rates                                                      |
| `/kubos`                                                      | Kubos, status, and availability                                           |
| `/reservations`                                               | Reservations and lifecycle (confirm, check-in, checkout, cancel, no-show) |
| `/reservations/:reservationId/kubos`                          | Kubo assignments and per-kubo check-in/check-out                          |
| `/reservations/:reservationId/payments`, `/payments`          | Payments, status transitions, refunds, and charge Adjustments/Reversals   |
| `/reservations/:reservationId/overpayment-approvals`, `/overpayment-approvals/:approvalId/revoke` | Administrator overpayment approvals (BR-053); Staff use them when a payment exceeds the balance |
| `/additional-charge-catalog`                                  | Charge catalog (Administrator writes)                                     |
| `/additional-charges`, `/reservations/:reservationId/charges` | Applied charges                                                           |
| `/additional-charge-requests`                                 | Custom charge requests and approval                                       |
| `/audit-logs`                                                 | Audit log reads (Administrator only)                                      |

### Authentication

1. Call `POST /auth/login` with `{ "username": "...", "password": "..." }`.
2. Send the returned token as `Authorization: Bearer <token>` on every other request.
3. Routes enforce the `Administrator` or `Staff` role where required.

The acting employee always comes from the token; a client-supplied `employeeId` is ignored. Each token carries a unique id (`jti`). `POST /auth/logout` revokes that token until it expires and records an audit entry; the employee's other sessions stay signed in. There are no refresh tokens: when a token expires (`JWT_EXPIRES_IN`, default `8h`), sign in again.

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

Example (PowerShell, from the repository root). Set `base_url` to
`<host><API_BASE_PATH>` so it matches `backend/.env`:

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
│   ├── .infisical.yaml   # Infisical project link
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
├── .github/workflows/        # backend-ci, frontend-ci, keep-alive
├── docs/                     # Business rules, architecture, API, ERD, flowcharts, Infisical guide
├── frontend/                 # Vite + React app (src/features/*, src/components, src/lib) and UI docs
│   └── .infisical.yaml       # Infisical project link
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
| [`docs/infisical.md`](docs/infisical.md)                             | Team guide to Infisical secrets and `infisical run`      |
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
- Open a pull request against `main` and fill in every section of [`.github/pull_request_template.md`](.github/pull_request_template.md). GitHub pre-fills it in the browser, but `gh pr create --body` does not; use `gh pr create --body-file` with a filled copy. CI must pass.

### Development rules

- No ORM. Use `pg` with parameterized queries.
- Validate all external input with Zod before business logic.
- Do not invent database fields, relationships, endpoints, or business rules.
- Do not bypass services or repositories.
- Prefer simple implementations over new abstractions or dependencies.
- Keep changes focused; do not modify unrelated files.

---

## Known Limitations

- There are no refresh tokens. Sessions end when the access token expires (`JWT_EXPIRES_IN`, default `8h`).
- Tokens issued before token revocation was deployed have no `jti` and are refused once; affected users sign in again.
- Refunds recorded before `20261114_link_refunds_to_original_payment.sql` are linked by a backfill from their audit description; any refund whose description could not be matched stays unlinked.
- Page-1 of the draw.io ERDs predates the uuid keys and derived totals. The "Charges, payments & auth (2026-11)" page covers the newer tables; the migrations remain the source of truth.
- The additional-charge migration skips its routines if the `kubo_additional_charges_management` schema does not exist.

---

## Roadmap

- **Day-use and exclusive-event bookings (BR-083 to BR-093): planned for December 2026.** This work is deliberately kept off `main` until then. A business-rules addendum and a draft migration (`20261110_add_day_use_and_event_bookings.sql`) exist on the `feat/day-use-bookings` branch; the reservation, kubo type, and upgrade routes still need to be wired. Do not add day-use code to `main` before December. See [`docs/development-progress.md`](docs/development-progress.md#planned-work).

---

## License

This project is developed for academic purposes.
