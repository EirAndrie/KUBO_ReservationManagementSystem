# Validation

## Validation Flow

Validation occurs **before** the service executes. The flow is:

```
Request → Route validation middleware → Controller → Service → Repository → PostgreSQL
```

Typical usage in routes:

```ts
router.post("/", validateBody(createGuestSchema), createGuestController);
```

The controller receives already‑validated data and can focus on business logic.

## Zod and drizzle‑zod

- **Zod** is used for application‑level validation of request payloads.
- `drizzle‑zod` may be used to generate Zod schemas from database schema definitions, but **drizzle‑orm** must not be used for querying.
- Example Zod schema for a guest:

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

## Validation Best Practices

- Validate **all** external input (body, query, path params) using Zod schemas.
- Use custom error messages where helpful for API consumers.
- Keep validation logic in the `repository/validations` folder of each module.
- Validation should be lightweight; complex business rules belong in the service layer.

## DTOs (Data Transfer Objects)

- Export DTO types from validation files using `z.infer`:

```ts
export type GuestCreateDTO = z.infer<typeof createGuestSchema>;
```

Services consume these DTOs, ensuring type‑safe interaction between layers.
