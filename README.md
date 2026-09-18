# KUBO Reservation Management System

A reservation management system for resort operations, built with the **PERN stack**.

The system manages guests, employees, rooms, room types, reservations, payments, additional charges, and operational auditing.

---

## Tech Stack

| Layer             | Technology            |
| ----------------- | --------------------- |
| Database          | PostgreSQL            |
| Backend           | Node.js + Express     |
| Frontend          | React                 |
| Language          | TypeScript            |
| Database Driver   | `pg`                  |
| Validation        | Zod                   |
| Schema Validation | `drizzle-zod`         |
| Architecture      | Feature-based modules |

> **Important:** The project does **not** use an ORM. Drizzle ORM is prohibited. `drizzle-zod` is used only for validation/schema generation where appropriate.

---

## Project Structure

The project uses a **feature-based module architecture**.

```text
src/
└── modules/
    ├── guest/
    │   ├── repository/
    │   │   ├── schemas/
    │   │   ├── procedures/
    │   │   ├── validations/
    │   │   └── ...
    │   ├── guest.controller.ts
    │   ├── guest.service.ts
    │   └── guest.routes.ts
    │
    ├── reservation/
    │   ├── repository/
    │   │   ├── schemas/
    │   │   ├── procedures/
    │   │   ├── validations/
    │   │   └── ...
    │   ├── reservation.controller.ts
    │   ├── reservation.service.ts
    │   └── reservation.routes.ts
    │
    ├── room/
    ├── room-type/
    ├── employee/
    ├── payment/
    ├── additional-charge/
    └── audit-log/
```

Each module owns its domain-specific implementation.

The `repository/` directory belongs directly to its feature and contains PostgreSQL-specific implementation.

---

## Backend Architecture

The backend follows this dependency flow:

```text
HTTP Request
     ↓
Route
     ↓
Controller
     ↓
Service
     ↓
Repository
     ↓
PostgreSQL Function / Procedure
     ↓
PostgreSQL
```

### Responsibilities

**Routes**

- Define API endpoints.
- Connect middleware and validation to controllers.
- Do not contain business logic.

**Controllers**

- Handle HTTP concerns.
- Read request data.
- Call services.
- Return HTTP responses.
- Do not execute SQL.

**Services**

- Contain application and business logic.
- Coordinate operations between modules when necessary.
- Do not access PostgreSQL directly.

**Repositories**

- Handle database access.
- Execute PostgreSQL functions/procedures through `pg`.
- Handle database-specific queries and result mapping.
- Keep PostgreSQL-specific implementation inside the owning module.

**PostgreSQL**

- Stores persistent data.
- Enforces database constraints.
- Executes database functions/procedures.
- Handles transactional database operations where required.

---

## Database Architecture

PostgreSQL is accessed through the `pg` Node.js driver.

The project uses PostgreSQL functions and procedures for database operations instead of an ORM.

```text
Service
   ↓
Repository
   ↓
pg
   ↓
PostgreSQL Function / Procedure
   ↓
Tables
```

Database-specific code must remain inside the appropriate module's `repository/` directory.

Queries must always use parameterized values.

```ts
await pool.query("SELECT * FROM kubo.get_guest_by_id($1)", [guestId]);
```

Do not construct SQL using string interpolation.

---

## Validation

External input is validated using **Zod**.

Typical validation flow:

```text
Request
   ↓
Zod Schema
   ↓
Controller
   ↓
Service
   ↓
Repository
```

Validation should cover:

- Request body
- Route parameters
- Query parameters
- Business-specific input requirements

TypeScript types do not replace runtime validation.

PostgreSQL constraints remain responsible for database-level integrity.

---

## Documentation

Project-specific development rules are separated into dedicated documents.

```text
AGENTS.md

docs/
├── architecture.md
├── database.md
├── api.md
├── validation.md
├── coding-standards.md
├── project-context-prompt.md
└── developer-prompt-template.md
```

### Documentation Responsibilities

| Document                       | Purpose                                                           |
| ------------------------------ | ----------------------------------------------------------------- |
| `AGENTS.md`                    | Project-wide instructions for coding agents                       |
| `architecture.md`              | Module structure and layer responsibilities                       |
| `database.md`                  | PostgreSQL, repositories, functions, procedures, and transactions |
| `api.md`                       | REST API conventions                                              |
| `validation.md`                | Zod and validation rules                                          |
| `coding-standards.md`          | TypeScript, naming, errors, security, and testing                 |
| `project-context-prompt.md`    | Compact context for coding agents                                 |
| `developer-prompt-template.md` | Template for feature implementation requests                      |

Read `AGENTS.md` before making architectural or implementation changes.

Read the relevant `docs/*.md` file before working on a specific area.

---

## Production-Ready Code Documentation

Major features and complex implementations must include understandable JSDoc documentation.

Example:

```ts
/**
 * Creates a reservation and assigns the requested rooms.
 *
 * The operation is executed atomically through PostgreSQL so that
 * the reservation and room assignments cannot be partially persisted.
 *
 * @param data - Validated reservation data.
 * @returns The created reservation and assigned rooms.
 * @throws {AppError} When the guest does not exist.
 * @throws {AppError} When one or more requested rooms are unavailable.
 */
```

Comments should explain:

- Purpose
- Business rules
- Important parameters
- Return values
- Side effects
- Transactional behavior
- Security requirements
- Non-obvious implementation decisions
- Important failure conditions

Avoid comments that simply restate obvious code.

---

## Prerequisites

| Tool       | Recommended   |
| ---------- | ------------- |
| Node.js    | 20+ LTS       |
| npm        | 10+           |
| PostgreSQL | 15+           |
| Git        | Latest stable |

---

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd KUBO_ReservationManagementSystem
```

### 2. Install dependencies

If the backend is located in `backend/`:

```bash
cd backend
npm install
```

---

## Environment Configuration

Create the backend environment file:

```bash
cp example.env .env
```

Example:

```env
# Server
PORT=4000
NODE_ENV=development

# PostgreSQL
DB_URL=postgresql://<user>:<password>@<host>:<port>/<database>

# Frontend origin
FR_ORIGIN=http://localhost:3000

# Application configuration
PASSWORD_LENGTH=8
```

Do not commit `.env` files or credentials to the repository.

---

## Database Setup

The project uses PostgreSQL directly.

Database setup should follow the SQL schema and database documentation defined in:

```text
docs/database.md
```

If the project contains database initialization or migration scripts, use the existing project commands.

Do not introduce Drizzle migrations or ORM-generated schema files.

---

## Running the Backend

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Production

```bash
node dist/server.js
```

Use the project's existing npm scripts where available.

---

## API

The backend exposes REST endpoints through Express.

Typical structure:

```text
/api
├── /guests
├── /employees
├── /roles
├── /rooms
├── /room-types
├── /reservations
├── /payments
├── /additional-charges
└── /audit-logs
```

Exact endpoint behavior is defined in:

```text
docs/api.md
```

Do not assume an endpoint exists without checking the current implementation or API documentation.

---

## Development Workflow

Before implementing a feature:

```text
1. Read AGENTS.md
       ↓
2. Identify the affected module
       ↓
3. Read the relevant documentation
       ↓
4. Inspect existing implementation
       ↓
5. Identify the correct layer
       ↓
6. Implement the smallest required change
       ↓
7. Add production-ready JSDoc when appropriate
       ↓
8. Run relevant checks
       ↓
9. Review for unrelated changes
```

---

## Contribution Guidelines

1. Create a feature branch.

```bash
git checkout -b feature/your-feature-name
```

2. Implement the requested change.
3. Follow `AGENTS.md` and the relevant documentation.
4. Reuse existing project patterns.
5. Run relevant tests and type checks.
6. Review the changes before committing.
7. Commit with a clear message.
8. Push the branch.
9. Open a pull request against the project's target branch.

---

## Development Rules

- Do not introduce an ORM.
- Do not use Drizzle ORM.
- Use `pg` for PostgreSQL access.
- Use Zod for runtime validation.
- Keep database code inside repositories.
- Keep SQL out of controllers and services.
- Use PostgreSQL functions/procedures according to the database architecture.
- Parameterize database queries.
- Do not duplicate existing business logic.
- Do not invent database relationships or API behavior.
- Inspect existing code before introducing new patterns.
- Do not modify unrelated files.
- Prefer simple implementations over unnecessary abstractions.
- Add production-ready JSDoc to major features and complex logic.
- Keep implementation summaries concise.

---

## License

This project is developed for academic purposes.
