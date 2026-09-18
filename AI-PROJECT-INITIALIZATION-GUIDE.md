# AI Developer Guide

## Purpose

This guide explains how developers should use AI coding assistants with the KUBO Reservation Management System.

It applies to any AI coding assistant that can inspect the project files, including:

- Codex
- Claude Code
- Cursor
- Gemini
- ChatGPT
- Other IDE-integrated coding agents

The goal is to give the AI enough project context without repeatedly pasting large amounts of documentation into prompts.

---

# 1. Project Context Structure

The project stores its development rules and technical documentation inside the repository.

```text
KUBO Reservation Management System/
│
├── AGENTS.md
│
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── api.md
│   ├── validation.md
│   ├── coding-standards.md
│   ├── project-context-prompt.md
│   └── developer-prompt-template.md
│
├── backend/
├── frontend/
└── README.md
```

These files have different purposes.

| File                           | Purpose                                  |
| ------------------------------ | ---------------------------------------- |
| `README.md`                    | Human-facing project overview and setup  |
| `AGENTS.md`                    | Project-wide AI development rules        |
| `architecture.md`              | Application architecture                 |
| `database.md`                  | PostgreSQL and database implementation   |
| `api.md`                       | API conventions                          |
| `validation.md`                | Zod and validation                       |
| `coding-standards.md`          | Code quality and development conventions |
| `project-context-prompt.md`    | Compact AI context                       |
| `developer-prompt-template.md` | Reusable task prompt                     |

The documentation is the project's source of truth.

---

# 2. First-Time AI Initialization

When a developer first opens the project with an AI coding assistant, do not immediately ask it to implement a feature.

First establish project context.

Use the following prompt.

```text
You are working on the KUBO Reservation Management System.

Before making any code changes, initialize your understanding of the project.

1. Inspect the repository structure.
2. Read AGENTS.md.
3. Read the relevant documentation under docs/.
4. Inspect the existing backend and frontend structure.
5. Identify the existing architectural and implementation patterns.
6. Compare the documentation with the current implementation.
7. Identify any important inconsistencies between documentation and code.

Do not modify any files.

Do not implement any feature.

Do not reproduce the documentation in your response.

Instead, build an internal understanding of the project that can be used for future implementation tasks.

After completing the inspection, provide:

1. A concise confirmation that the project context has been established.
2. A concise summary of the architecture you discovered.
3. Any important documentation/code inconsistencies.
4. A compact reusable Project Context Prompt that can be used for future development tasks.

Keep the response concise. Do not dump large amounts of documentation or code.
```

This is the **initialization prompt**.

It should normally only be necessary when a developer first starts working with the project or when the project architecture changes significantly.

---

# 3. Do Not Repeat the Entire Context

After initialization, developers should not repeatedly paste:

```text
We use PERN.

We use PostgreSQL.

We don't use an ORM.

We use pg.

We use Zod.

We use PostgreSQL functions.

Our controllers do this.

Our services do this.

Our repositories do this.

Our modules are structured this way.

...
```

This wastes context.

Instead, use the project documentation.

The AI should be instructed to inspect the relevant documentation when necessary.

For example:

```text
Implement reservation cancellation.

Follow AGENTS.md and the relevant documentation under docs/.

Inspect the existing reservation module before making changes.

Requirements:
- Only pending and confirmed reservations can be cancelled.
- Record the cancellation.
- Create the required audit log.
- Prevent cancellation after checkout.
```

The task prompt contains the **task**, while the repository contains the **context**.

---

# 4. Use the Relevant Documentation

The AI does not always need to read every documentation file.

Use the smallest relevant context.

### Database change

Read:

```text
AGENTS.md
docs/architecture.md
docs/database.md
docs/validation.md
```

### API endpoint

Read:

```text
AGENTS.md
docs/architecture.md
docs/api.md
docs/validation.md
```

### Frontend feature

Read:

```text
AGENTS.md
docs/architecture.md
docs/api.md
docs/coding-standards.md
```

### Refactoring

Read:

```text
AGENTS.md
docs/architecture.md
docs/coding-standards.md
```

This keeps AI context focused.

---

# 5. Standard Feature Development Workflow

Every feature should follow this workflow:

```text
Developer describes task
        ↓
AI identifies affected module
        ↓
AI reads relevant documentation
        ↓
AI inspects existing implementation
        ↓
AI identifies existing patterns
        ↓
AI determines correct architectural layer
        ↓
AI implements the smallest required change
        ↓
AI adds production-ready documentation
        ↓
AI runs relevant checks
        ↓
AI reports the result
```

Do not ask the AI to immediately generate code before it understands the existing implementation.

---

# 6. Standard Developer Prompt

Use this structure when requesting a feature.

```text
## Task

[Describe what needs to be implemented.]

## Requirements

- [Requirement]
- [Requirement]
- [Requirement]

## Constraints

- Follow AGENTS.md.
- Read the relevant documentation under docs/.
- Inspect the existing implementation before coding.
- Reuse existing patterns and utilities.
- Do not introduce a new architectural pattern unless necessary.
- Do not modify unrelated code.
- Add production-ready JSDoc for major features and complex logic.
- Run relevant tests and type checks.

## Expected Result

[Describe the expected behavior.]
```

Developers do not need to provide information that already exists in the repository.

---

# 7. Example

Instead of writing a large prompt:

```text
We use Express and TypeScript.

Our backend uses controllers.

Controllers call services.

Services call repositories.

Repositories use pg.

We don't use Drizzle ORM.

We use PostgreSQL functions.

Zod handles validation.

Our reservation module is structured...

...
```

Use:

```text
Implement reservation creation.

Requirements:
- Create a reservation for an existing guest.
- Allow multiple rooms.
- Validate the request with Zod.
- Ensure requested rooms are available.
- Record the operation in the audit log.

Follow AGENTS.md and the relevant documentation.

Inspect the existing reservation, guest, room, and audit-log implementations before coding.

Reuse existing patterns.

Add production-ready JSDoc for the major implementation.

Do not modify unrelated code.
```

The second prompt is substantially more efficient.

---

# 8. Ask the AI to Inspect Before Implementing

For non-trivial changes, explicitly tell the AI to inspect first.

Use:

```text
Before making changes, inspect:

- the affected module
- related modules
- relevant database functions
- existing validation schemas
- existing tests
- relevant documentation

Then explain briefly where the change belongs.

After that, implement it.
```

This prevents the AI from inventing patterns that already exist elsewhere in the project.

---

# 9. Production-Ready Comments

AI-generated code must remain understandable to human developers.

For every major feature, complex workflow, or non-obvious implementation, require production-ready JSDoc.

Example:

```ts
/**
 * Confirms a pending reservation and assigns its rooms.
 *
 * The operation is executed atomically through PostgreSQL to prevent
 * the reservation from being confirmed without successfully assigning
 * all requested rooms.
 *
 * Business rules:
 * - Only pending reservations can be confirmed.
 * - All requested rooms must be available.
 * - A reservation must have at least one reserved room.
 *
 * @param reservationId - The reservation being confirmed.
 * @param employeeId - The employee performing the operation.
 * @returns The confirmed reservation.
 * @throws {AppError} When the reservation does not exist.
 * @throws {AppError} When the reservation cannot be confirmed.
 * @throws {AppError} When one or more rooms are unavailable.
 */
```

Comments should explain **why the implementation exists and what important rules it enforces**.

Do not require comments for obvious code.

Avoid:

```ts
// Get reservation
const reservation = await getReservation(id);
```

Prefer documentation around the actual business behavior:

```ts
/**
 * Confirms a reservation after validating its current lifecycle state
 * and ensuring that all requested rooms can be assigned atomically.
 */
```

---

# 10. Ask for Focused Changes

AI coding assistants can modify more files than necessary.

Developers should explicitly constrain the scope.

Example:

```text
Only modify the reservation module and the database function required
for this feature.

Do not refactor unrelated modules.
Do not rename existing files.
Do not introduce new dependencies.
```

This reduces accidental changes.

---

# 11. Ask for a Diff-Oriented Result

For implementation tasks, ask the AI to report:

```text
After implementation, provide:

1. Files changed
2. What changed in each file
3. Tests/checks executed
4. Any unresolved issues
```

Do not ask it to paste entire modified files unless necessary.

A good result looks like:

```text
Implemented reservation cancellation.

Changed:
- reservation.routes.ts
  Added DELETE /reservations/:id endpoint.
- reservation.controller.ts
  Added request handling and validation.
- reservation.service.ts
  Added cancellation business rules.
- reservation.repository.ts
  Added PostgreSQL function call.
- cancel_reservation.sql
  Added atomic cancellation operation.

Checks:
- TypeScript compilation passed.
- Reservation tests passed.

No unrelated files modified.
```

---

# 12. When Documentation and Code Conflict
