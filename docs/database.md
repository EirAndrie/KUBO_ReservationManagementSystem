# Database

## Repository Folder Overview

The `repository` folder contains everything directly related to PostgreSQL or persistence.

```
repository/
├── schemas/       # Database row types, drizzle‑zod generated schemas, Zod schemas derived from DB structures
├── procedures/    # PostgreSQL functions and procedures (raw SQL files)
├── validations/   # Zod validation schemas for request payloads
├── queries/       # Reusable raw SQL queries when a stored function does not exist
└── <feature>.repository.ts  # TypeScript layer that calls `pg` and the stored functions/procedures
```

### Schemas (`schemas/`)

- Contains database‑related schemas and types, e.g. `guest.schema.ts`, `reservation.schema.ts`.
- May include drizzle‑zod generated schemas, Zod schemas derived from DB structures, and PostgreSQL‑specific type definitions.

### Procedures (`procedures/`)

- Holds PostgreSQL functions and procedures, e.g. `create-guest.sql`, `cancel-reservation.sql`.
- Example function:

```sql
CREATE OR REPLACE FUNCTION kubo.create_guest(
    p_first_name VARCHAR,
    p_last_name VARCHAR,
    p_email VARCHAR,
    p_phone VARCHAR
) RETURNS kubo.guest LANGUAGE plpgsql AS $$
DECLARE v_guest kubo.guest;
BEGIN
    INSERT INTO kubo.guest (first_name, last_name, email, phone)
    VALUES (p_first_name, p_last_name, p_email, p_phone)
    RETURNING * INTO v_guest;
    RETURN v_guest;
END;
$$;
```

### Validations (`validations/`)

- Zod schemas used to validate incoming request bodies before they reach the service layer.
- Example:

```ts
import { z } from "zod";

export const createGuestSchema = z.object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      email: z.email().optional(),
      phone: z.string().max(30).optional(),
});

export type CreateGuestDTO = z.infer<typeof createGuestSchema>;
```

## PostgreSQL Functions & Procedures

- **Functions** return data (e.g., `get_guest_by_id`).
- **Procedures** perform actions without returning a row (e.g., `cancel_reservation`).
- Prefer functions when the backend needs the resulting record.

## Database Connection

- A single shared PostgreSQL connection pool lives in `src/database/pool.ts`:

```ts
import { Pool } from "pg";

export const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
});
```

Repositories import this shared pool; do not create new pools per repository.

## SQL Parameterization

- Always use parameterized queries to avoid injection:

```ts
await pool.query(`SELECT * FROM kubo.get_guest_by_id($1)`, [guestId]);
```

Never interpolate user‑controlled values directly into SQL strings.

## Database Integrity

- PostgreSQL is the authoritative source for constraints: primary keys, foreign keys, unique constraints, not‑null, checks, enums, indexes, stored functions, and transactions.
- Zod validates format but does **not** replace database constraints.

## Transactional Operations

- When multiple tables must be updated atomically, implement a single PostgreSQL function that wraps the whole transaction (e.g., creating a reservation, reserved rooms, payments, audit logs).
- This prevents partial updates and keeps the operation atomic.

## Error Handling (Database Side)

- Repositories may detect database‑specific errors (e.g., unique‑violation) and throw `AppError` with appropriate HTTP status codes.
- Services translate these into application‑level errors, and controllers forward them to the centralized error handler.

## Audit Logging

- `kubo.audit_log` is append-only. `kubo_audit_management.prevent_audit_mutation`
  blocks `UPDATE`, `DELETE`, and `TRUNCATE` (BR-069).
- `kubo_audit_management.write_audit_log(p_employee_id, p_action, p_entity_type,
  p_entity_id, p_description, p_old_values, p_new_values)` writes a row and verifies the
  acting employee exists.
- Read routines:
  - `kubo.get_audit_log_by_id(p_audit_id)`
  - `kubo.search_audit_logs(...)`
  - `kubo.get_audit_history(p_entity_type, p_entity_id, p_limit, p_offset)`
- Mutation routines call `write_audit_log` inside their own transaction (BR-071), so a
  failed mutation rolls its audit row back. Login and logout call it from the
  application layer because they have no database mutation routine.
