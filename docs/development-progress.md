# Development Progress

Ordered by database dependencies so each entity can be built on top of the
previous one.

**Last updated:** 2026-10-31

| Order | Entity | Status | Notes |
|---:|---|---|---|
| 1 | `role` | Complete | CRUD, validation, and reference-safe deletion are in place. Audit wiring waits on authentication. |
| 2 | `employee` | In progress | CRUD, safe reads, filtering/search, password reset, and last-Administrator checks are in place. Audit wiring and RBAC remain. |
| 3 | `guest` | In progress | CRUD, reuse-by-email/ID, full profile updates, DB pagination, and unused-guest deletion are in place. Admin-only deletion and audit writes wait on authentication. |
| 4 | `kubo_type` | Scaffolded | Module layers exist; repository calls TODO stored functions. |
| 5 | `kubo` | Scaffolded | Module layers exist but routes are not mounted. No stored functions yet. |
| 6 | `reservation` | Scaffolded | Module layers exist; repository calls TODO stored functions. |
| 7 | `reserved_kubo` | Scaffolded | Module layers exist; assignment, check-in/out, and search functions are TODO. |
| 8 | `additional_charge` | Scaffolded | Module layers exist; repository calls TODO stored functions. |
| 9 | `payment` | Scaffolded | Module layers exist; repository calls TODO stored functions. |
| 10 | `audit_log` | Scaffolded | Module layers exist; repository calls TODO stored functions. |

## Status legend

- **Complete** — usable end to end against the database.
- **In progress** — core flow works, but validation or business rules remain.
- **Scaffolded** — routes, controllers, services, repository, and schemas exist,
  but the database functions or integration are incomplete.
- **Not started** — no module implementation yet.

## Next up

1. Finish `employee` validation and business-rule coverage.
2. Implement and migrate the `guest` stored functions.
3. Continue down the list in order.

## Notes

- Migrations currently cover the role schema and recent employee function fixes.
- Most non-role repositories still call stored functions that are not shipped in
  `backend/src/migrations`.
- `room_kubo` must be mounted in `backend/src/modules/index.ts` before its routes
  can be tested.
