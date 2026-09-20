# Frontend AI Agent Instructions (frontend-agents.md)

Welcome to the AI Agent instruction manual for the **KUBO Reservation Management System (Frontend)**. As an AI agent working on this codebase, you must adhere strictly to the rules, conventions, and architectural patterns outlined below. This ensures high code quality, consistency, and strict alignment with the backend services.

## Project Context

The frontend is a specialized resort admin dashboard built with modern React tools and practices.

- **Framework:** Vite + React + TypeScript
- **UI & Styling:** Ant Design (antd) + CSS Modules
- **State Management:** TanStack Query for server state; React Context for local UI state
- **API Client:** Axios or fetch wrapper with strictly typed responses
- **Backend Environment:** Node.js + Express + PostgreSQL (RESTful API)
- **Architecture:** Feature-based modular architecture mirroring backend domain modules

### Backend Modules Consumed
The frontend interfaces with the following core backend modules via the REST API:
1. **Guest:** CRUD operations (`first_name`, `last_name`, `email`, `phone`).
2. **Reservation:** Comprehensive lifecycle management of bookings.
3. **Room:** Inventory and physical room management.
4. **Room Type:** Categorization and attributes for rooms.
5. **Employee:** Staff management with Role-Based Access Control (RBAC).
6. **Payment:** Financial transactions and payment tracking.
7. **Additional Charge:** Incidentals and extra service fees.
8. **Audit Log:** System-wide activity and security logging.

---

## Project Documentation References

Before implementing features or making structural changes, **you must read** the relevant internal documentation:

- `docs/frontend-architecture.md`
- `docs/frontend-api-integration.md`
- `docs/frontend-component-guide.md`
- `docs/frontend-coding-standards.md`
- `docs/frontend-ui-specification.md`

---

## Core Rules

1. **Inspect Before Changing:** Always review existing code, interfaces, and patterns before proposing or making changes.
2. **Follow Existing Conventions:** Mirror the established project structure and naming conventions perfectly.
3. **Consult Documentation:** Read the relevant markdown docs before writing implementation code.
4. **Strict Domain Boundaries:** Do NOT invent API endpoints, request/response fields, or business rules. Match the backend contract exactly.
5. **Scoped Modifications:** Do NOT modify unrelated code or files outside the scope of your current task.
6. **Minimal Viable Change:** Implement the smallest, most efficient change required to fulfill the user's request.
7. **Preserve Behavior:** Ensure existing features, accessibility standards, and type safety are maintained.
8. **Constants:** Never use magic strings for statuses, roles, or methods (e.g., 'pending', 'admin'). Always import from the `src/constants/` enums.

---

## Architecture Rules

- **Feature-Based Modules:** Organize the `src/` directory by feature (e.g., `src/features/reservations/`).
- **Separation of Concerns:** Keep pages, components, hooks, services, and types strictly separated within their respective feature folder.
- **Import Boundaries:** Must use barrel exports (`index.ts`) for cross-feature imports. Never import from a feature's internal folders directly.
- **Cross-Feature Communication:** Use shared hooks, prop drilling (max 2 levels), or barrel exports. No circular dependencies between features.
- **Path Aliases:** Always use `@/` for imports outside the current directory instead of relative paths like `../../`.
- **Shared UI:** Place generic, reusable, and cross-feature UI components strictly in `src/components/ui/`.
- **Service Layer:** API calls must reside in dedicated service files (e.g., `guest.service.ts`). **Never** make API calls directly inside a React component.
- **Do Not Bypass Services:** All data fetching and mutations must flow through the service layer.

---

## UI & Styling Rules

- **Ant Design Foundation:** Use Ant Design (antd) components as base building blocks for all interfaces (e.g., Table, Form, DatePicker, Select, Modal, Button, Badge, Tag, etc.).
- **Icons:** Use `@ant-design/icons` for all icon needs.
- **Layout:** Use Ant Design's `Layout`, `Sider`, and `Menu` components for structural page layouts.
- **Styling:** Use Ant Design's design tokens and `ConfigProvider` for theming. Use CSS Modules for custom styles. NO TailwindCSS utility classes.
- **Composability:** Build UI components to be composable, reusable, and cleanly separated from business logic.
- **Accessibility (a11y):** All interactive elements (buttons, inputs, modals, dialogs) MUST include proper ARIA attributes, keyboard navigation support, and semantic HTML.

---

## State Management Rules

- **Server State (TanStack Query):** Use TanStack Query exclusively for all server-side data (fetching, caching, synchronization, mutations).
- **UI State (React Context):** Use React Context ONLY for global or complex UI state (e.g., sidebar toggling, active theme, global modal state).
- **No `useState` for Server Data:** Never store fetched API data in local `useState` or `useEffect` loops. Rely on TanStack Query's `data` properties.
- **Custom Hook Interface:** Components should not interact with TanStack Query directly. Create custom hooks (e.g., `useGuests()`, `useCreateReservation()`) to act as the interface between the UI and data layers.
- **Standardized Mutations:** Enforce the use of a custom `useAppMutation` wrapper for TanStack Query to ensure consistent error handling and toasts.

---

## API Integration Rules

- **Centralized Client:** Use the configured, typed API client located in `src/lib/api.ts` (or similar core location).
- **Type Parity:** All API request payloads and response types must strictly match the backend contract (often utilizing shared DTO schemas if available).
- **State Handling:** You must explicitly handle and render `loading`, `error`, and `empty` states for all remote data fetching.
- **Error Boundaries:** Wrap critical UI sections in React Error Boundaries to prevent full app crashes on API failure.

---

## Validation Rules

- **Zod for Schemas:** Validate all form inputs and complex data structures using Zod. Ensure schemas mirror backend validation logic where applicable.
- **React Hook Form:** Use `react-hook-form` integrated with `@hookform/resolvers/zod` for all form state and validation handling.
- **Inline Feedback:** Display validation errors inline, immediately adjacent to the offending input fields.

---

## Production Code Quality

- **TypeScript Strict Mode:** The codebase runs with `"strict": true`. Respect it.
- **No `any` Types:** The use of `any` is strictly prohibited. Define precise interfaces or use `unknown` with type narrowing if necessary.
- **Robust Error Handling:** Do not swallow errors. Log them appropriately and present user-friendly error messages.
- **Responsive Design:** As an admin dashboard, prioritize a **desktop-first** responsive design strategy, but ensure it remains usable on smaller screens.
- **Accessibility Compliance:** Code must pass standard a11y audits (e.g., WCAG guidelines for contrast, screen readers, and focus management).
