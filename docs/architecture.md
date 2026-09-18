# Architecture

## Core Architecture

The project follows a **module‑based architecture**. Each module represents a domain or major resource.

```text
module/
├── feature1/
│   ├── repository/
│   │   ├── schemas/
│   │   ├── procedures/
│   │   ├── validations/
│   │   ├── queries/
│   │   └── ...
│   ├── feature1.controller.ts
│   ├── feature1.service.ts
│   └── feature1.routes.ts
│
├── feature2/
│   ├── repository/ …
│   ├── feature2.controller.ts
│   ├── feature2.service.ts
│   └── feature2.routes.ts
│
└── feature3/ …
```

**Do not** create a global structure such as `src/controllers`, `src/services`, etc.; domain‑specific database logic stays inside its module.

## Layer Responsibilities

```
Route → Controller → Service → Repository → PostgreSQL Function / Procedure → PostgreSQL
```

- **Route** – defines HTTP method, URL, middleware and the controller.
- **Controller** – handles HTTP concerns, calls services, returns responses, forwards errors.
- **Service** – contains application‑level business logic, coordinates repositories.
- **Repository** – talks to PostgreSQL via functions/procedures, maps results.
- **PostgreSQL** – stores data, enforces constraints, runs transactions.

## Architectural Boundary

Maintain a strict dependency direction:

```
Routes → Controller → Service → Repository → PostgreSQL
```

Never reverse this direction. For example, repositories must not import controllers or services, and controllers must never execute SQL directly.

## Final Architecture Diagram

```
                    ┌──────────────────────┐
                    │       Express        │
                    └──────────┬───────────┘
                               │
                         HTTP Request
                               │
                               ▼
                    ┌──────────────────────┐
                    │        Routes        │
                    └──────────└───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │      Controller      │
                    └──────────└───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │       Service        │
                    └──────────└───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │      Repository      │
                    │  schemas, validations,
                    │  procedures, queries │
                    └──────────└───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     PostgreSQL       │
                    │  Functions, Procedures,
                    │  Constraints, Transactions
                    └──────────────────────┘
```

Each feature follows the same structure:

```text
feature/
├── repository/
│   ├── schemas/
│   ├── procedures/
│   ├── validations/
│   ├── queries/
│   └── feature.repository.ts
├── feature.controller.ts
├── feature.service.ts
└── feature.routes.ts
```
