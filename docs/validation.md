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

## Additional-Charge Validation

### Catalog item

- `chargeType` must be one of the `kubo.charge_type` enum values.
- `name` is required, trimmed, and unique case-insensitively.
- `description` is optional, max 255 characters.
- `unitPrice` is required, non-negative, and has at most two decimals.
- `isActive` defaults to `true`.

```ts
const catalogItemSchema = z.object({
      chargeType: z.enum(CHARGE_TYPES),
      name: z.string().trim().min(1).max(100),
      description: z.string().trim().max(255).optional(),
      unitPrice: z.number().nonnegative().refine((value) => Number(value.toFixed(2)) === value),
      isActive: z.boolean().default(true),
});
```

### Applying a catalog charge

- `catalogId` must be a valid UUID.
- The catalog item must exist and be active.
- `quantity` must be a positive integer, default `1`.
- Staff cannot override `unitPrice`.
- The server calculates `amount = quantity × unit_price` and stores a snapshot.

### Custom charge request

- `chargeType` is forced to `Other`.
- `description` is required, trimmed, max 255 characters.
- `quantity` must be a positive integer, default `1`.
- `proposedUnitAmount` must be non-negative with at most two decimals.
- Requests are accepted only for reservations in a chargeable status.
- Pending requests do not affect the balance.

### Approval, rejection, and adjustment

- Only an Administrator may review a request.
- Only a `Pending` request can be approved, rejected, adjusted, or withdrawn.
- Staff may withdraw only their own pending request.
- A withdrawn request cannot be approved later; Staff must submit a new request.
- `approvedUnitAmount` is optional on approval; when omitted, the proposed amount is used.
- A reason is required when rejecting or adjusting the amount.
- Approval creates the applied `additional_charge` atomically.
- Rejection and withdrawal create no charge.

### Applied-charge deletion

- Only Staff may delete before settlement.
- A charge is locked after checkout or once included in a completed payment/refund.
- Administrators must use a new correction record, not edit or delete.

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

## Audit Log Query Validation

The audit read API validates query parameters with `AuditLogFilterSchema`
(`backend/src/modules/audit-logs/repository/audit-log.schema.ts`):

- `employeeId` — optional UUID.
- `action` — one of `Create`, `Update`, `Delete`, `Login`, `Logout`, `Cancel`,
  `Approve`, or `Reject`. Case-insensitive input is normalized to these values.
- `entityType` — optional trimmed string, max 255 characters.
- `entityId` — optional UUID.
- `createdFrom` / `createdTo` — optional coerced dates; `createdTo` must not be
  earlier than `createdFrom`.

`GET /audit-logs/history/:entityType/:entityId` validates `entityId` as a UUID via
`requireUuidParam` and reads `entityType` as a non-empty string.

The audit `action` enum (`kubo.audit_action`) is append-only on the read side; there is
no create/update schema because audit rows are never mutated through the application
(BR-069).
