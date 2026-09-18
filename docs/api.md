# API

## API Structure

Use **RESTful** routes. Example for guests:

```
POST   /api/guests
GET    /api/guests
GET    /api/guests/:id
PATCH  /api/guests/:id
DELETE /api/guests/:id
```

Reservations follow a similar pattern, with nested resources where appropriate (e.g., payments, charges, rooms).

## Query Parameters

Use query parameters for filtering, searching, pagination, and sorting. Example:

```
GET /api/employees?role=admins&status=active&search=juan&page=1&limit=10
```

Common parameters include:

- `search`
- `status`
- `role`
- `page`
- `limit`
- `sort`
- `order`

Validate query parameters using Zod schemas.

## Pagination

Pagination must be performed at the database level; never retrieve the full dataset and slice in JavaScript.

Typical request:

```
GET /api/guests?page=1&limit=10
```

The repository should call a PostgreSQL function that supports pagination, e.g.:

```sql
kubo.get_guests(
    p_search,
    p_page,
    p_limit
)
```

## Naming Conventions (API Layer)

- Route file naming: `<resource>.routes.ts`
- Controller file naming: `<resource>.controller.ts`
- Service file naming: `<resource>.service.ts`
- Repository file naming: `<resource>.repository.ts`
- Function/procedure naming in PostgreSQL: `snake_case`
- TypeScript identifiers: `camelCase` for variables/functions, `PascalCase` for types/classes.

## Error Handling (API Layer)

- Controllers should use the centralized error handler (`handleControllerError`) to translate `AppError` instances into proper HTTP responses.
- Do not expose raw PostgreSQL errors to clients.
