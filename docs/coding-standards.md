# Coding Standards

## Naming Conventions

- **TypeScript**: `camelCase` for variables/functions, `PascalCase` for types/classes.
- **Files**: Lower‑case with dot separators, e.g., `guest.controller.ts`, `guest.service.ts`, `guest.routes.ts`, `guest.repository.ts`.
- **PostgreSQL**: `snake_case` for tables, columns, functions, and procedures.

## Project Structure

- Follow the module‑based layout described in **Architecture**.
- Keep domain‑specific code inside its module; shared code goes under `src/config`, `src/database`, `src/middleware`, `src/utils`, `src/types`.

## Agent Rules (Coding Guidelines)

1. Inspect the existing module before making changes.
2. Keep PostgreSQL‑related code inside `repository/`.
3. Store procedures/functions inside `repository/procedures/`.
4. Store schemas/types inside `repository/schemas/`.
5. Keep validation schemas inside `repository/validations/`.
6. Database access (`pg` queries) resides only in `<feature>.repository.ts`.
7. Application logic goes in `<feature>.service.ts`.
8. HTTP handling stays in `<feature>.controller.ts`.
9. Route definitions live in `<feature>.routes.ts`.
10. Never access `pg` from controllers or services.
11. Do **not** use any ORM for querying; only `pg` and stored procedures.
12. `drizzle‑zod` may be used for validation/schema generation.
13. Always use parameterized queries; avoid string interpolation in SQL.
14. Do not duplicate database logic across modules.
15. Preserve PostgreSQL constraints; never invent fields not present in the ERD.
16. Use transactions for operations that must be atomic.
17. Keep controllers thin, services focused on business logic, repositories focused on persistence.
18. Reuse existing utilities (`logger`, `http` helpers, pagination helpers).
19. Avoid unnecessary abstractions or dependencies.
20. Write tests for each layer according to its responsibility (Zod, repository, service, controller, PostgreSQL).

## Error Handling

- Use `AppError` (status code + message) for predictable HTTP errors.
- Controllers should forward errors to `handleControllerError` which logs and returns a consistent JSON error shape.
- Do not expose raw database errors to clients.

## Security

- Never return sensitive fields like `password_hash`.
- Authentication/authorization belongs in middleware, not in individual modules.
- Validate and sanitize all inputs.
