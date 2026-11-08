# Project Structure Guide

This guide explains what each folder in the repository is for and how the parts connect. It is written for anyone browsing the code for the first time, including our instructor.

If you only have five minutes, read [The big picture](#the-big-picture) and [Follow one request](#follow-one-request-creating-a-guest).

## The big picture

KUBO is a PERN app (PostgreSQL, Express, React, Node.js) written in TypeScript. It has two separate apps in one repository:

| Folder | What it is | Runs on |
| --- | --- | --- |
| `frontend/` | The website staff and admins use (React + Vite) | Browser, `http://localhost:5173` |
| `backend/` | The REST API that holds all the rules (Node.js + Express) | Server, `http://localhost:8080` |
| PostgreSQL | The database. Most business rules live here as stored functions | Database server |

```text
 Browser (React)  --HTTP + JWT-->  Express API  --SQL function calls-->  PostgreSQL
   frontend/                         backend/                         kubo schemas
```

The frontend never talks to the database directly. It only calls the API. The API checks who you are, validates the input, and then calls a PostgreSQL function that does the real work inside a transaction.

## Top-level folders

```text
KUBO_ReservationManagementSystem/
├── .github/workflows/ci.yml   # GitHub Actions: installs, type-checks, and builds the backend on every push and PR to main
├── .postman/resources.yaml    # Links the local Postman collection to our Postman Cloud workspace
├── AGENTS.md                  # Rules and current state notes for AI coding assistants (also useful for humans)
├── README.md                  # Setup, run commands, and documentation index
├── backend/                   # Express REST API (see "Backend" below)
├── docs/                      # Business rules, ERD, flowcharts, API and database notes
├── frontend/                  # React web app (see "Frontend" below)
└── postman/                   # Postman collection for testing every API endpoint
```

## Backend

The backend is split by **feature** (one folder per database entity), not by layer. Everything about guests is in `modules/guest/`, everything about payments is in `modules/payment/`, and so on. This keeps related code together.

```text
backend/
├── example.env                # Template for backend/.env (copy it, then fill in your own values; never commit .env)
├── nodemon.json               # Restarts the server automatically when a file changes (npm run dev)
├── package.json               # Backend dependencies and scripts (dev, build, typecheck)
├── tsconfig.json              # TypeScript compiler settings
└── src/
    ├── server.ts              # Entry point: checks env values, sets up CORS, mounts routes, runs migrations, starts listening
    │
    ├── config/                # Settings read once at startup
    │   ├── env.ts             # Loads .env values into one ENV object
    │   ├── auth.ts            # JWT secret and token lifetime (8 hours by default)
    │   └── connectDB.ts       # The shared PostgreSQL connection pool, exported as `db`
    │
    ├── migrations/            # SQL files run in filename order on startup (YYYYMMDD_description.sql)
    │                          # Each file runs once. Applied files are recorded in the schema_migrations table.
    │
    ├── utils/                 # Small helpers shared by every module
    │   ├── http.ts            # AppError, validateBody(), requireUuidParam(), and mapDatabaseError() (Postgres error -> HTTP status)
    │   ├── auth.ts            # Signs and verifies JWT tokens
    │   ├── pagination.ts      # Reads ?page and ?limit and builds the paging info in responses
    │   ├── logger.ts          # Winston logger that writes to the console and logs/ folder
    │   ├── migrate.ts         # The migration runner used by server.ts
    │   └── serverValidation.ts# Startup checks (port, CORS origin, JWT secret strength)
    │
    └── modules/               # One folder per feature. Each has the same four layers.
        ├── index.ts           # Mounts every module's routes. /auth is public; everything after it needs a valid token.
        ├── auth/              # Login, logout, current user. Also holds the authenticate and authorizeRoles middleware.
        ├── role/              # Roles (Administrator, Staff)
        ├── employee/          # Employee accounts
        ├── guest/             # Guest records
        ├── room_kubo-type/    # Kubo types (category, capacity, price)
        ├── room_kubo/         # Individual kubos (huts) and their status
        ├── reservation/       # Reservations: create, confirm, cancel, check-in, check-out
        ├── reserved-room_kubo/# Which kubos are assigned to a reservation
        ├── additional-charges/# Charge catalog, applied charges, and custom charge requests
        ├── payment/           # Payments, refunds, and adjustments
        └── audit-logs/        # Read-only audit trail (Administrator only)
```

### Inside one module

Every module uses the same file pattern. Using `guest/` as the example:

```text
modules/guest/
├── API_CONTRACT.md            # Endpoints for this module: URL, who can call it, request body, and response
├── guest.routes.ts            # 1. Route: the URL + HTTP method, plus role check and input validation middleware
├── guest.controllers.ts       # 2. Controller: reads the request, calls the service, sends the JSON response
├── guest.services.ts          # 3. Service: business logic in TypeScript. No SQL here.
└── repository/
    ├── guest.repository.ts    # 4. Repository: the only place with SQL. Calls PostgreSQL functions with $1, $2 parameters.
    └── guest.schema.ts        # Zod schemas: the allowed shape of request bodies (required fields, formats, limits)
```

The rule is that calls only go **down** this list. A route calls a controller, a controller calls a service, a service calls a repository. A controller never writes SQL, and a repository never sends an HTTP response.

| Layer | Its one job | Example from the guest module |
| --- | --- | --- |
| Route | Decide who may call which URL | `POST /guests` needs the Staff role and a valid body |
| Controller | Translate HTTP to a function call and back | Take `req.body`, return `201` with the new guest |
| Service | Apply rules that need code | Throw a 404 if the guest does not exist |
| Repository | Talk to the database safely | `SELECT * FROM kubo_guest_management.fn_create_guest(...)` |
| PostgreSQL | Enforce data rules and save | Unique email, valid ID type, write the audit row |

## Frontend

The frontend is also split by **feature**. Each folder in `src/features/` matches a screen area in the app and talks to one backend module.

```text
frontend/
├── .env.example               # VITE_API_BASE_URL: where the backend API lives
├── index.html                 # The single HTML page Vite loads React into
├── vite.config.ts             # Vite build settings and the @/ import shortcut for src/
├── eslint.config.js           # Lint rules (npm run lint)
├── docs/                      # Frontend plans: architecture, UI spec, component guide, API integration notes
├── public/                    # Files served as-is (logos, favicon)
└── src/
    ├── main.tsx               # Starts React
    ├── App.tsx                # The router: lists every page URL and wraps them in login protection
    ├── index.css, App.css     # Global styles
    │
    ├── lib/                   # Plain helpers with no React
    │   ├── api.ts             # The single axios client. Adds the login token to every request and handles errors.
    │   ├── format.ts          # Shows money (PHP) and dates the same way on every page
    │   ├── time.ts            # Resort time zone handling
    │   └── utils.ts           # cn() helper for combining CSS class names
    │
    ├── hooks/                 # React hooks shared by all features
    │   ├── use-app-mutation.hook.ts   # Wraps save/update/delete calls and shows success or error messages
    │   └── use-debounced-value.hook.ts# Waits until the user stops typing before searching
    │
    ├── theme/                 # Light and dark mode (provider, context, and toggle button)
    │
    ├── components/            # Reusable UI pieces used across many pages
    │   ├── ui/                # Basic building blocks: Button, Input, Select, Modal, Table, Badge, Spinner
    │   ├── common/            # Small shared widgets: StatusBadge, FilterChip, RowMenu, empty and loading states
    │   └── layout/            # The app frame: AppShell, Sidebar, Navbar, PageHeader
    │
    └── features/              # One folder per area of the app
        ├── auth/              # Login page, AuthProvider (who is logged in), ProtectedRoute
        ├── dashboard/         # Admin and Staff home pages
        ├── reservation/       # Reservation list, detail page, and the new-reservation wizard
        ├── check-in-out/      # Front desk queue for check-in and check-out
        ├── guest/             # Guest list and guest detail pages
        ├── kubo/              # Kubo list and status
        ├── kubo-type/         # Kubo type management
        ├── payment/           # Payment list and payment forms
        ├── employee/          # Employee management (Administrator)
        └── audit-logs/        # Audit log viewer (Administrator)
```

### Inside one feature

Using `features/guest/` as the example:

```text
features/guest/
├── index.ts                   # The feature's public "front door". Other features import only from here.
├── pages/                     # Full screens linked in App.tsx (guest-list.page.tsx, guest-detail.page.tsx)
├── components/                # Pieces used by those pages (guest form, guest search dropdown)
├── hooks/                     # React Query hooks: useGuests() loads data, useCreateGuest() saves it and refreshes the list
├── services/                  # guest.service.ts: the actual API calls (GET /guests, POST /guests, ...). No React here.
├── types/                     # TypeScript types that match the API's request and response shapes
└── constants/                 # Fixed values such as ID type options and field length limits
```

The data path inside a feature is: **page -> hook -> service -> `lib/api.ts` -> backend**.

## Follow one request: creating a guest

This is what happens when a staff member fills in the guest form and clicks Save.

1. `frontend/src/features/guest/components/guest-form.component.tsx` collects the form values.
2. `features/guest/hooks/use-guest-mutations.hook.ts` (`useCreateGuest`) calls the service and shows a success or error message.
3. `features/guest/services/guest.service.ts` sends `POST /guests` through `lib/api.ts`, which attaches the login token.
4. `backend/src/modules/index.ts` checks the token (`authenticate`) because every route except `/auth` is protected.
5. `modules/guest/guest.routes.ts` checks the role is Staff and validates the body against `CreateGuestSchema` in `repository/guest.schema.ts`.
6. `guest.controllers.ts` passes the data and the logged-in employee's ID to the service.
7. `guest.services.ts` calls the repository.
8. `repository/guest.repository.ts` calls `kubo_guest_management.fn_create_guest(...)` with parameterized SQL.
9. PostgreSQL inserts the guest and writes the audit log row in the same transaction. If either fails, both are rolled back.
10. The new guest goes back up the same chain. React Query refreshes the guest list, so the new row appears.

## Docs and testing folders

```text
docs/
├── business_rules.md          # The main specification: BR-001 to BR-082, the rules the system must follow
├── ERD.drawio                 # Entity relationship diagram (open with draw.io / diagrams.net)
├── ERD&Flowcharts.drawio      # ERD plus system flowcharts in one file
├── system_flowcharts.md       # Flowcharts in text form
├── architecture.md            # Layer rules and the target module layout
├── database.md                # How the backend uses PostgreSQL functions and transactions
├── api.md                     # REST conventions (status codes, error format)
├── validation.md              # How Zod validation is done
├── coding-standards.md        # Naming and code style
├── audit-logging-checklist.md # Which actions must be written to the audit log
├── development-progress.md    # Status of each module
└── PROJECT_STRUCTURE.md       # This guide

postman/
├── collections/KUBO_ManagementSystem/   # One folder per API area (Auth, Guest, Reservations, Payments, ...)
│   └── Write Tests (test DB only)/      # Tests that create and then delete their own data. Run only on a test database.
├── environments/local.environment.yaml  # Base URL and test account variables for a local run
└── globals/                              # Shared Postman variables
```

## Where to find things

| I want to see... | Look in |
| --- | --- |
| The business rules | `docs/business_rules.md` |
| The database design | `docs/ERD.drawio` and `backend/src/migrations/` |
| Every API endpoint | `backend/src/modules/<feature>/API_CONTRACT.md` |
| Login and role checks | `backend/src/modules/auth/` |
| The SQL that saves data | `backend/src/modules/<feature>/repository/<feature>.repository.ts` |
| Input validation rules | `backend/src/modules/<feature>/repository/<feature>.schema.ts` |
| The list of pages and URLs | `frontend/src/App.tsx` |
| A screen's code | `frontend/src/features/<feature>/pages/` |
| How the frontend calls the API | `frontend/src/lib/api.ts` and `frontend/src/features/<feature>/services/` |
| API tests | `postman/collections/KUBO_ManagementSystem/` |
| Automated checks on GitHub | `.github/workflows/ci.yml` |

## Naming conventions

- Backend files: `<feature>.routes.ts`, `<feature>.controllers.ts`, `<feature>.services.ts` (plural suffixes).
- Frontend files: the suffix tells you the role, for example `guest-list.page.tsx`, `guest-form.component.tsx`, `use-guests.hook.ts`, `guest.service.ts`, `guest.types.ts`.
- `*.module.css` files hold styles for the component with the same name.
- Migrations: `YYYYMMDD_short_description.sql`. Old migrations are never edited; a change gets a new file.
- Some backend folders still use the older `room_kubo` name. In the app and the API they are called "kubo" and "kubo type".
