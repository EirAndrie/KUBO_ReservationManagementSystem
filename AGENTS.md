# Kubo Reservation System - Agent Instructions

These instructions apply to every AI coding agent (Claude Code, Codex, Copilot,
Cursor, and others). `CLAUDE.md` imports this file.

## Rules That Agents Commonly Skip

Read these before doing anything else. They are not optional.

1. **Pull requests must use the PR template.** Before opening or editing a pull
   request, read `.github/pull_request_template.md` and fill in every section.
   `gh pr create --body "..."` and `gh pr create --fill` do **not** apply the
   template. Copy the template to a scratch file, fill it in, and run
   `gh pr create --body-file <file>` (or `gh pr edit <n> --body-file <file>`).
   Write "None" or "Not checked" instead of deleting a section, and tick only the
   checks you actually ran.
2. **Conventional Commits** for every commit: `type(scope): short description`,
   lowercase imperative, no trailing period. One commit per coherent change.
3. **Do not add day-use or exclusive-event booking code to `main` before December
   2026.** See [Deferred Work](#deferred-work).
4. **Never run write tests against the shared database.** Use the test database
   (see [Testing](#testing)).
5. **Update the docs that describe behavior you change** (see the PR template
   checklist).

## Start Here

- There are two runnable apps: `backend/` (Express + PostgreSQL API) and
  `frontend/` (React 19 + Vite + TanStack Query + Ant Design). Run each app's
  commands from its own folder.
- `docs/business_rules.md` is the authoritative domain specification. The
  `business_rules_DDL.md` and `business_rules_review.md` files it references do not
  exist in this repo.
- Read the relevant doc before changing an area: `docs/architecture.md`,
  `database.md`, `api.md`, `validation.md`, `coding-standards.md`,
  `system_flowcharts.md`, and each backend module's `API_CONTRACT.md`.
- For frontend work, read `frontend/docs/frontend-agents.md` and its companion files
  (`frontend-architecture.md`, `frontend-coding-standards.md`,
  `frontend-api-integration.md`). Where they disagree with the code, the code wins.
- `docs/development-progress.md` is the running status page.

## Commands

```bash
cd backend
npm ci              # CI uses this; npm install also works
npm run dev         # nodemon -> ts-node src/server.ts
npm run typecheck   # tsc --noEmit; required by CI
npm run build       # tsc -> dist/, postbuild copies src/migrations to dist/migrations
npm run db:seed     # additive, idempotent demo data
```

```bash
cd frontend
npm ci
npm run dev         # Vite on http://localhost:3000 (strictPort; backend CORS allows FR_ORIGIN only)
npm run typecheck
npm run lint        # eslint
npm run build       # tsc -b && vite build
```

- CI: `.github/workflows/backend-ci.yml` runs `npm ci`, `typecheck`, `build`;
  `frontend-ci.yml` runs `npm ci`, `typecheck`, `lint`, `build`. `keep-alive.yml`
  pings `/health` every 5 minutes.
- There is no unit or integration test framework. Do not claim one exists. API
  verification uses the Postman collection (see [Testing](#testing)).
- Secrets for the team are in Infisical (`docs/infisical.md`); `DB_*` values stay in
  local `backend/.env`.

## Setup and Environment

- CI uses Node 22; README recommends PostgreSQL 15+.
- Create `backend/.env`. `dotenv` loads relative to the working directory, so start the
  server from `backend/`.
- The PostgreSQL pool reads `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`,
  `DB_NAME`. `DB_URL` and `PASSWORD_LENGTH` are declared in `src/config/env.ts` but
  unused.
- `API_BASE_PATH` (optional, default `/api`) sets the mount prefix for every API route.
  This project uses `/KUBO_Resort/Management-System/v0.0.1`; the frontend
  `VITE_API_BASE_URL` must include the same path. Leading `/`, no trailing `/`.
- `FR_ORIGIN` is the single CORS origin the backend allows.
- With `NODE_ENV=production`, the backend serves `frontend/dist` unless
  `SERVE_FRONTEND=false` (the deployed setup: Render API + Vercel frontend).
- Startup requires a live database. It connects, then runs every
  `src/migrations/*.sql` not yet in `schema_migrations`, in filename order, each in a
  transaction. Never edit a migration that has been applied; add a new file.
- `JWT_SECRET` is required (32+ characters in production); `JWT_EXPIRES_IN` defaults
  to `8h`.
- `src/utils/logger.ts` creates `logs/` relative to the working directory.

## Backend Layout

The real module layout is flatter than `docs/architecture.md` describes:

```text
backend/src/modules/<feature>/
├── <feature>.routes.ts
├── <feature>.controllers.ts
├── <feature>.services.ts
├── API_CONTRACT.md          (most modules)
└── repository/
    ├── <feature>.repository.ts
    └── <feature>.schema.ts
```

- File suffixes are plural (`*.controllers.ts`, `*.services.ts`).
- Keep the dependency direction strict: routes -> controllers -> services ->
  repositories -> PostgreSQL. Do not create global `src/controllers`,
  `src/services`, or `src/repositories` folders.
- Import the shared pool as `db` from `src/config/connectDB.ts`.
- SQL belongs only in repositories. Always use parameterized queries, typically
  against stored functions shipped in `src/migrations`.
- Routes apply `validateBody(...)`, `requireUuidParam(...)`, and
  `authorizeRoles(...)`; controllers call `getPagination(req.query)` and
  `handleControllerError(...)`.
- Error handling is per-controller: `throw new AppError(status, message)`, catch in
  the controller, then call `handleControllerError`. `mapDatabaseError` maps
  `23505`/`23514`/`22023` -> `400`, `23503` -> `409`, `P0002` -> `404`, `42501` -> `403`.
- Response envelopes differ by module (`data`, `guests`, `payments`,
  `overpaymentApprovals`, raw arrays). Match the module you are editing.

## Frontend Layout

```text
frontend/src/
├── App.tsx                  routes (ProtectedRoute with allowedRoles)
├── components/{common,layout,ui}
├── features/<feature>/{components,hooks,pages,services,types}/ + index.ts
├── lib/ (api client, format helpers)
└── theme/
```

- Import another feature only through its `index.ts` barrel, never its internal
  paths.
- Server state uses TanStack Query hooks; mutations use `useAppMutation` (toasts).
- Show server error messages verbatim; never recompute balances in the UI
  (`outstanding_balance` comes from the API).

## API Wiring

- `backend/src/modules/index.ts` is the source of truth for mounted routes.
- Public: `GET /health` (200, or 503 JSON when the database is unreachable) and
  `/auth/login`. Everything else passes the global `authenticate` middleware.
- Prefixes: `/auth`, `/roles`, `/guests`, `/kubo-types`, `/kubos`, `/employees`,
  `/reservations`, `/audit-logs`, plus root-mounted payment and additional-charge
  route groups.
- Reservation assignments: `/reservations/:reservationId/kubos`. Payments:
  `/reservations/:reservationId/payments` and `/payments`. Overpayment approvals:
  `/reservations/:reservationId/overpayment-approvals` and
  `/overpayment-approvals/:approvalId/revoke`. Additional charges:
  `/additional-charge-catalog`, `/additional-charges`,
  `/additional-charge-requests`, `/reservations/:reservationId/charges`,
  `/reservations/:reservationId/charge-requests`.
- The acting employee is always `req.auth.employeeId`; clients cannot supply an
  `employeeId` to act for someone else.
- Roles are the canonical lowercase values `administrator` and `staff` (BR-005: the
  roles are disjoint).

## Data and Validation Rules

- PostgreSQL through `pg` only. No ORM, no Drizzle. `drizzle-zod` is not installed;
  use plain `zod` (v4).
- Validate external input with Zod before business logic: bodies at the route,
  query/path values in the controller or `requireUuidParam`.
- PostgreSQL is the constraint authority, but some invariants are application-only.
  `docs/business_rules.md` lists the gaps (overlapping stays, at-least-one-kubo,
  status transitions).
- Reservation totals, charges, net paid, and balances are derived
  (`fn_get_reservation_balance`), never stored. `reservationTotalAmount` in the
  backend reservation schema is stale (BR-040/G-06).
- Prefer stored functions for multi-table or atomic operations, and write the audit
  row (`kubo_audit_management.write_audit_log`) in the same function.

## Current Progress Context (2026-11-14)

Context for a new agent; `docs/business_rules.md` stays authoritative.

### Module state

| Area | Current state |
|---|---|
| `auth` | JWT login/me/logout. Tokens carry a `jti`; logout revokes it in `kubo_auth_management.revoked_token`. Tokens without a `jti` are refused. No refresh tokens. |
| `role`, `employee` | CRUD, safe reads, password reset, last-Administrator checks, Administrator-only RBAC, audited. |
| `guest` | CRUD, reuse-by-email/ID, DB pagination, unused-guest deletion (Administrator), audited with masked `id_number`. |
| `kubo_type`, `kubo` | CRUD, search, rates, status transitions, availability, reference-safe deletion, audited. |
| `reservation`, `reserved_kubo` | Atomic create/update, reference codes, assignments, derived totals, confirm/cancel/no-show, check-in/out, zero-balance checkout guard, Staff-only lifecycle, audited. |
| `additional_charge*` | Admin catalog, Staff catalog application, custom requests with Admin approve/reject/adjust, pre-settlement deletion, Admin increase corrections. |
| `payment` | Pending creation, status transitions, refunds linked by `related_payment_id`, charge Adjustments/Reversals (G-07 resolved), BR-053 overpayment approvals, Admin cleanup deletion. |
| `audit_log` | Append-only; every tracked mutation plus login/logout; Administrator read API. |
| Frontend | Deployed. All modules above, including the Administrator charge-request review page (`/charge-requests`) and overpayment approvals on the reservation page. |

### Payments and charges in brief

- Payments start `Pending`; only `Completed` payments count. Allowed transitions:
  `Pending` -> `Processing`/`Completed`/`Failed`/`Cancelled`; `Processing` ->
  `Completed`/`Failed`/`Cancelled`. `Refunded`/`PartiallyRefunded` come only from the
  refund routine.
- Refunds: Staff-only, against a completed payment of the same reservation, positive
  amount, capped by net paid and by the original payment's unrefunded amount.
- BR-053: a payment above the balance needs an Administrator overpayment approval
  (max excess + reason). Staff pass `overpaymentApprovalId`; it is consumed by that
  payment, re-checked on completion, released on Failed/Cancelled, revocable while
  unused. The credit must be refunded before check-out.
- Adjustments/Reversals are Administrator-only non-cash corrections against one
  applied charge; they change the balance but not cash `net_paid`.
- Custom charge requests (`Pending`, `Approved`, `Rejected`, `Withdrawn`) do not
  affect the balance until approved.

### Migration inventory

- `20240920_create_role_schema.sql`
- `20261031_*`: audit management and history, employee filters/profile fix, guest,
  role/employee hardening.
- `20261101_*`: kubo, kubo type, reservation hardening.
- `20261102_*`: additional-charge hardening, reservation charge-request delete guard,
  payment hardening, balance/refund status fix.
- `20261103_add_auth_management.sql`
- `20261104_*`: audit wiring (guest/kubo, identity, reservation).
- `20261106_enforce_canonical_role_names.sql`
- `20261108_fix_reservation_delete_and_payment_adjustments.sql`
- `20261114_add_overpayment_approval.sql`, `20261114_add_token_revocation.sql`,
  `20261114_link_refunds_to_original_payment.sql`

### Known gaps and risks

- No refresh tokens; sessions end at token expiry.
- The additional-charge migration skips its routines if the pre-existing
  `kubo_additional_charges_management` schema is absent.
- Page-1 of `docs/ERD.drawio` and `docs/ERD&Flowcharts.drawio` predates uuid keys and
  derived totals; the "Charges, payments & auth (2026-11)" page covers the newer
  tables. The migrations are the source of truth.
- Payment cleanup deletion bypasses the no-delete policy by design and must stay
  Administrator-only.

## Deferred Work

- **Day-use and exclusive-event bookings (BR-083 to BR-093) are scheduled for
  December 2026.** The business-rules addendum and the draft migration
  `20261110_add_day_use_and_event_bookings.sql` live on the `feat/day-use-bookings`
  branch, not on `main`. Do not add day-use code, migrations, or docs to `main` before
  December. When work resumes: rebase that branch onto `main`, then wire the
  reservation, kubo type, and upgrade routes and the frontend.

## Testing

- Collection: `postman/collections/KUBO_ManagementSystem` (Postman CLI). Credentials
  are passed with `--env-var` and never committed.
- Read-only requests may run against the normal development database.
- The `Write Tests (test DB only)` folder runs only with `--env-var allow_writes=true`
  and only against a test copy: start a second backend from `backend/` with
  `DB_NAME=kubo_beach_resort_system_test` and `PORT=8081`.
- Report exactly what was run and what was not checked.

## Documentation Expectations

Add production-ready JSDoc (`/** */`) for major features, services, repositories, and
non-obvious logic: purpose, business rules, parameters/returns, database side effects,
transaction boundaries, security requirements, and failure behavior. Do not restate
obvious code or leave stale comments. When behavior changes, update the module
`API_CONTRACT.md`, `docs/development-progress.md`, README "Known Limitations", and
`docs/business_rules.md` as applicable.

## Workflow

1. Inspect the affected module and its existing patterns.
2. Read the relevant `docs/*.md` file and, for domain behavior,
   `docs/business_rules.md`.
3. Choose the correct layer; keep SQL out of controllers and services.
4. Reuse existing helpers (`http`, `pagination`, `logger`, shared `db`,
   `useAppMutation`) instead of adding abstractions.
5. Make the smallest change; do not touch unrelated docs or code.
6. Run the checks for each app you changed (backend `typecheck`/`build`; frontend
   `typecheck`/`lint`/`build`).
7. Verify route mounting and response shape for API changes.
8. Commit with Conventional Commits and open the PR with the filled-in template.

## Rules and Priorities

- Do not invent database fields, relationships, endpoints, or business rules.
- Do not bypass services or repositories.
- Do not introduce an ORM, new database driver, or unnecessary dependency.
- Preserve existing behavior unless the task requires changing it.
- When instructions conflict, follow: explicit task requirements, then this file,
  then `docs/*.md`, then existing conventions.
