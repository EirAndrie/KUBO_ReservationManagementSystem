# Frontend Coding Standards

This document outlines the coding standards, architecture patterns, and best practices for the KUBO Reservation Management System frontend.

## Project Context
Our frontend stack is built for type safety, performance, and maintainability:
- **Core:** Vite + React + TypeScript (Strict Mode)
- **UI & Styling:** Ant Design (antd) + CSS Modules
- **State Management:** TanStack Query (server state) + React Context (UI state)
- **Forms & Validation:** Ant Design built-in Form system (Zod + `react-hook-form` is optional for complex validations)
- **Domain:** Admin dashboard for resort reservation management

---

## 1. Naming Conventions

Consistent naming is critical for codebase navigation and maintainability.

### Files and Directories
Use **kebab-case** for file and directory names. File names should include a dot-separated suffix indicating their type.
- **Directories (Features):** `guest/`, `reservation/`, `room-type/`
- **Pages:** `guest-list.page.tsx`, `dashboard.page.tsx`
- **Components:** `guest-form.component.tsx`, `room-card.component.tsx`
- **Styles:** `guest-list.module.css`, `room-card.module.css`
- **Hooks:** `use-guests.hook.ts`, `use-create-reservation.hook.ts`
- **Services:** `guest.service.ts`
- **Types:** `guest.types.ts`
- **Utils/Helpers:** `date-formatter.util.ts`

### Code Entities
- **Components:** `PascalCase` (e.g., `GuestList`, `ReservationForm`, `RoomCard`)
- **Hooks:** `camelCase` with a `use` prefix (e.g., `useGuests`, `useCreateReservation`)
- **Types/Interfaces:** `PascalCase` (e.g., `Guest`, `Reservation`, `PaginatedResponse`)
- **Variables/Functions:** `camelCase` (e.g., `fetchGuests`, `isFormValid`)
- **Constants:** `SCREAMING_SNAKE_CASE` (e.g., `API_BASE_URL`, `DEFAULT_PAGE_SIZE`)
- **CSS Classes:** camelCase or kebab-case standard for CSS Modules (e.g., `container`, `cardHeader`)

---

## 2. File Organization & Imports

We organize by feature (domain-driven) rather than by type, enforcing strict boundaries to prevent spaghetti code.

### General Rules
- **One Component per File:** Each file should export only one primary React component.
- **Colocation:** Keep related components, styles, hooks, services, constants, and types together within their feature directory.

### Example Feature Structure
```text
src/
└── features/
    └── reservation/
        ├── components/
        │   ├── reservation-list.component.tsx
        │   ├── reservation-list.module.css
        │   ├── reservation-form.component.tsx
        │   └── reservation-form.module.css
        ├── hooks/
        │   ├── use-reservations.hook.ts
        │   └── use-reservation-mutations.hook.ts
        ├── services/
        │   └── reservation.service.ts
        ├── types/
        │   └── reservation.types.ts
        ├── constants/
        │   └── reservation.constants.ts
        └── index.ts
```

### Import/Export Standards
Mandate `index.ts` barrel exports for features. Other features should only import from a feature's root `index.ts`, never bypassing it to reach internal files.

**Good (Importing via public API barrel):**
```ts
import { ReservationList, useReservations } from '@/features/reservation';
```

**Bad (Bypassing barrel file - creates spaghetti dependencies):**
```ts
import { ReservationList } from '@/features/reservation/components/reservation-list.component';
import { useReservations } from '@/features/reservation/hooks/use-reservations.hook';
```

### Path Aliases
Always use `@/` path aliases for absolute imports originating from the `src` directory. Avoid long, fragile relative paths (`../../`).

**Good:**
```ts
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/date.util';
```

**Bad:**
```ts
import { Button } from '../../../../components/ui/button';
import { formatDate } from '../../../utils/date.util';
```

---

## 3. TypeScript Standards

We leverage TypeScript's strict type checking to prevent runtime errors.

- **Strict Mode:** Always enabled in `tsconfig.json`.
- **No `any`:** Never use `any`. Use `unknown` if the type is truly unknown, and narrow it using type guards.
- **Types vs Interfaces:**
  - Use `interface` for object shapes and classes.
  - Use `type` for unions, intersections, and utility types.
- **Explicit Exports:** Always export types that are used across multiple files.
- **Discriminated Unions:** Use for modeling complex state shapes.

### Example: Discriminated Union
```tsx
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

---

## 4. Component Patterns

- **Functional Components:** Only use functional components. No class components.
- **Ant Design Primitives:** Use antd components as primitives, compose custom components on top of them.
- **Styling:** CSS Modules (`*.module.css`) for custom component styles. Ant Design's `ConfigProvider` for theme tokens. No utility-first CSS.
- **Props Interfaces:** Name them exactly `{ComponentName}Props`.
- **Destructuring:** Destructure props in the function signature.
- **Single Responsibility:** Keep components focused. Break them down if they do too much.

### Example: Component Structure
```tsx
import React, { useMemo } from 'react';
import { Card, Typography } from 'antd';
import type { Guest } from '@/features/guest/types/guest.types';
import styles from './guest-card.module.css';

const { Title, Text } = Typography;

interface GuestCardProps {
  guest: Guest;
  onSelect: (id: string) => void;
}

export function GuestCard({ guest, onSelect }: GuestCardProps) {
  // Memoize expensive computations
  const formattedName = useMemo(() => {
    return `${guest.firstName} ${guest.lastName}`.trim();
  }, [guest.firstName, guest.lastName]);

  return (
    <Card 
      className={styles.card} 
      hoverable 
      onClick={() => onSelect(guest.id)}
    >
      <Title level={4}>{formattedName}</Title>
      <Text type="secondary">{guest.email}</Text>
    </Card>
  );
}
```

- **ForwardRef:** Use `forwardRef` for components that need to pass a ref to a DOM element.

---

## 5. State Management Patterns

- **Server State (TanStack Query):** Use React Query for all data fetching, caching, and mutations. Encapsulate queries inside custom hooks.
- **Global UI State (React Context):** Use Context sparingly, only for app-wide UI states like themes, authentication status, or global modals.
- **Local State (useState/useReducer):** Use for component-specific state (e.g., open/close toggles, local form state).
- **Prop Drilling:** Avoid drilling props beyond 2 levels. Use composition (passing `children`) or Context instead.

### Example: Custom Query Hook
```tsx
// use-guests.hook.ts
import { useQuery } from '@tanstack/react-query';
import { guestService } from '@/features/guest/services/guest.service';

export function useGuests(page: number, limit: number = 10) {
  return useQuery({
    queryKey: ['guests', { page, limit }],
    queryFn: () => guestService.getGuests(page, limit),
  });
}
```

---

## 6. Form Patterns

We primarily use **Ant Design's built-in Form system** with `Form.Item` and validation rules. React-hook-form and Zod are optional but can be used for consistency with the backend if preferred.

- Use **antd's `rules` prop** for defining form validation.
- Combine antd components (`Input`, `Select`, etc.) within `Form.Item` wrappers.
- Show validation errors natively using antd's internal form mechanics.
- If using Zod, use it as an optional enhancement for complex, schema-level validations.

### Example: Form Setup
```tsx
import React from 'react';
import { Form, Input, Button } from 'antd';
import styles from './guest-form.module.css';

export interface GuestFormValues {
  firstName: string;
  lastName: string;
  email: string;
}

interface GuestFormProps {
  onSubmit: (data: GuestFormValues) => void;
  isLoading?: boolean;
}

export function GuestForm({ onSubmit, isLoading }: GuestFormProps) {
  const [form] = Form.useForm<GuestFormValues>();

  return (
    <Form 
      form={form} 
      layout="vertical" 
      onFinish={onSubmit}
      className={styles.formContainer}
    >
      <Form.Item
        name="firstName"
        label="First Name"
        rules={[{ required: true, message: 'First name is required' }, { min: 2, message: 'Must be at least 2 characters' }]}
      >
        <Input placeholder="First Name" />
      </Form.Item>

      <Form.Item
        name="lastName"
        label="Last Name"
        rules={[{ required: true, message: 'Last name is required' }, { min: 2, message: 'Must be at least 2 characters' }]}
      >
        <Input placeholder="Last Name" />
      </Form.Item>

      <Form.Item
        name="email"
        label="Email Address"
        rules={[
          { required: true, message: 'Email is required' },
          { type: 'email', message: 'Invalid email address' }
        ]}
      >
        <Input placeholder="Email Address" />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={isLoading}>
          Save
        </Button>
      </Form.Item>
    </Form>
  );
}
```

---

## 7. Error Handling & Mutation Standards

To avoid scattered `try/catch` blocks and manual toast notification logic across components, use a centralized **`useAppMutation` wrapper pattern** for TanStack Query mutations.

- **Runtime Errors:** Wrap major route segments or features in React Error Boundaries.
- **API Mutations:** Always use `useAppMutation` (a wrapper over `useMutation`) that automatically handles success/error toasts and standardizes error formatting.

### Example: `useAppMutation` Wrapper
```tsx
import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { message } from 'antd';

// A wrapper to standardize error handling and success messages
export function useAppMutation<TData, TError, TVariables, TContext>(
  options: UseMutationOptions<TData, TError, TVariables, TContext> & {
    successMessage?: string;
  }
) {
  return useMutation({
    ...options,
    onSuccess: (...args) => {
      if (options.successMessage) {
        message.success(options.successMessage);
      }
      options.onSuccess?.(...args);
    },
    onError: (error: any, ...args) => {
      // Standardize error message extraction
      const errorMessage = error?.response?.data?.message || error.message || 'An unexpected error occurred';
      message.error(errorMessage);
      options.onError?.(error, ...args);
    },
  });
}
```

### Example: Using `useAppMutation`
```tsx
import { useAppMutation } from '@/hooks/use-app-mutation.hook';
import { guestService } from '@/features/guest/services/guest.service';

export function useCreateGuest() {
  // No need for try/catch or manual toast logic in the component
  return useAppMutation({
    mutationFn: guestService.createGuest,
    successMessage: 'Guest created successfully!',
    // onSettled can be used to invalidate queries
  });
}
```

---

## 8. Accessibility (a11y)

- **Semantic HTML:** Use proper tags (`<nav>`, `<main>`, `<article>`).
- **Ant Design a11y:** Ant Design components come with basic accessibility support. Ensure proper configuration of labels and accessible properties when using custom implementations.
- **ARIA:** Add ARIA labels to interactive elements that lack text content (e.g., icon-only buttons).
- **Keyboard Navigation:** Ensure all interactive elements are focusable and can be triggered via `Enter` or `Space`.
- **Focus Management:** Trap focus within modals and dialogs (Ant Design's `Modal` and `Drawer` handle most of this out of the box).
- **Contrast:** Ensure colors meet WCAG contrast standards.

---

## 9. Performance

- **Lazy Loading:** Use `React.lazy()` and `<Suspense>` to code-split routes and load them on demand.
- **Debouncing:** Always debounce inputs that trigger API calls (like search bars).
- **Virtualization:** Use virtual scrolling for long lists to reduce DOM nodes (Ant Design provides virtualization for tables and lists, or use `@tanstack/react-virtual`).
- **Memoization:** 
  - Use `useMemo` for expensive calculations.
  - Use `useCallback` when passing functions as dependencies to child components optimized with `React.memo`, or when passing functions into effect dependency arrays. DO NOT overuse.
- **Image Optimization:** Size images appropriately and use modern formats like WebP.

---

## 10. Testing (Future)

Although testing might be implemented in a later phase, the architecture supports it natively:
- **Unit & Integration:** `Vitest` for fast, ESM-native testing.
- **Component Tests:** `React Testing Library` to test components as users interact with them, not implementation details.
- **API Mocking:** `Mock Service Worker (MSW)` to intercept requests during tests.

---

## 11. Constants & Magic Strings

Magic strings and numbers are brittle and cause silent bugs. Always extract them into dedicated constants files within the feature or globally.

- Group related constants using objects and `as const` to leverage TypeScript's literal types.
- Export derived types from those constants to ensure runtime and compile-time consistency.

### Example: Writing Constants
```ts
// src/features/reservation/constants/reservation.constants.ts

export const RESERVATION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
} as const;

export type ReservationStatus = typeof RESERVATION_STATUS[keyof typeof RESERVATION_STATUS];
```

### Example: Using Constants
```tsx
import React from 'react';
import { Tag } from 'antd';
import { RESERVATION_STATUS } from '@/features/reservation';
import type { ReservationStatus } from '@/features/reservation';

// Good: Using the constant
function StatusTag({ status }: { status: ReservationStatus }) {
  if (status === RESERVATION_STATUS.PENDING) {
    return <Tag color="orange">Pending</Tag>;
  }
  return <Tag color="blue">{status}</Tag>;
}

// Bad: Magic strings
function BadStatusTag({ status }: { status: string }) {
  if (status === 'pending') { // 'pending' might be typoed as 'pendng' with no TS error
    return <Tag color="orange">Pending</Tag>;
  }
  return <Tag color="blue">{status}</Tag>;
}
```
