# Kubo Reservation System - Agent Instructions

## Project Documentation

Read the relevant documentation before making changes:

- [Architecture](docs/architecture.md) - Module structure, layer responsibilities, dependencies, and architectural boundaries.
- [Database](docs/database.md) - PostgreSQL, repositories, functions/procedures, transactions, constraints, and database access.
- [API](docs/api.md) - Routes, endpoints, query parameters, pagination, responses, and HTTP conventions.
- [Validation](docs/validation.md) - Zod, drizzle-zod, request validation, DTOs, and validation boundaries.
- [Coding Standards](docs/coding-standards.md) - TypeScript conventions, naming, errors, security, testing, and implementation practices.

## Core Rules

- Inspect existing code before making changes.
- Follow the existing project structure and conventions.
- Read the relevant `docs/*.md` file before implementing a feature.
- Do not invent database fields, relationships, endpoints, or business rules.
- Do not modify unrelated code.
- Make the smallest change required to complete the task.
- Preserve existing behavior unless the task explicitly requires changing it.

## Architecture

- Use the module-based architecture defined in `docs/architecture.md`.
- Keep routes, controllers, services, and repositories separated by responsibility.
- Keep PostgreSQL-specific code inside the owning module's `repository/` directory.
- Do not place SQL or database access inside controllers or services.
- Do not bypass the service or repository layers.

## Database

- Use PostgreSQL through `pg`.
- Do not introduce an ORM.
- Do not use Drizzle ORM.
- `drizzle-zod` may be used for validation and schema generation.
- Use PostgreSQL functions/procedures according to `docs/database.md`.
- Always use parameterized queries.
- Keep database logic inside the appropriate repository/database layer.

## Validation

- Validate external input with Zod.
- Validate request bodies, parameters, and query parameters before business logic executes.
- Keep validation schemas consistent with API and database contracts.
- Do not rely on TypeScript types alone for runtime validation.

## Production-Ready Documentation

For every major feature, complex implementation, or non-obvious piece of logic, add production-ready JSDoc comments using `/** */`.

Comments must help another developer understand the implementation without reading the entire codebase.

Document when appropriate:

- The purpose of the feature or function.
- What the function does.
- Important business rules.
- Important parameters and return values.
- Database operations or side effects.
- Transactional behavior.
- Authorization or security requirements.
- Important assumptions.
- Why a non-obvious implementation was chosen.
- Important failure conditions or error behavior.

Example:

```ts
/**
 * Creates a reservation and assigns the requested rooms.
 *
 * The operation is executed through a PostgreSQL transaction to ensure
 * that the reservation and room assignments are committed atomically.
 * If any room is unavailable or the database operation fails, the
 * transaction is rolled back and no partial reservation is persisted.
 *
 * Business rules:
 * - A guest must exist before a reservation can be created.
 * - Requested rooms must be available for the reservation period.
 * - A reservation must have at least one reserved room.
 *
 * @param data - Validated reservation data.
 * @returns The newly created reservation with its assigned rooms.
 * @throws {AppError} When the guest or requested room does not exist.
 * @throws {AppError} When one or more requested rooms are unavailable.
 */
```

### Comment Quality Rules

- Write comments for maintainability, not decoration.
- Explain **why**, not only **what**.
- Do not repeat obvious code in comments.
- Do not write vague comments such as `// Create reservation`.
- Keep comments accurate when the implementation changes.
- Update affected comments when behavior changes.
- Do not document implementation details that can become outdated unnecessarily.
- Prefer JSDoc for public functions, services, repositories, complex business logic, and major database operations.
- Use normal `//` comments only for short local explanations.
- Do not add excessive comments to simple getters, setters, trivial CRUD operations, or self-explanatory code.

## Implementation Workflow

1. Inspect the relevant module and existing patterns.
2. Read the applicable documentation under `docs/`.
3. Identify the correct layer for the change.
4. Identify existing utilities and reusable logic.
5. Implement the smallest required change.
6. Add production-ready documentation for major or complex implementations.
7. Check related code for regressions.
8. Run the relevant tests, type checks, or validation commands.

## Prohibited

- No ORM.
- No Drizzle ORM.
- No direct PostgreSQL access from controllers.
- No direct PostgreSQL access from services.
- No SQL inside controllers or services.
- No duplicated business or database logic.
- No unnecessary abstractions.
- No unrelated refactoring.
- No invented requirements.
- No misleading, redundant, or outdated comments.

## Priority

When instructions conflict, follow this order:

1. Explicit task requirements.
2. `AGENTS.md`.
3. Relevant `docs/*.md` documentation.
4. Existing project conventions.
5. General implementation preferences.
