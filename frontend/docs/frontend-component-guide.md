# KUBO Reservation Management System: Frontend Component Guide

This document serves as the comprehensive component guide and design system reference for the KUBO Reservation Management System frontend admin dashboard. It details the foundational design tokens, layout structures, shared UI components, form elements, and feature-specific components required to build a consistent and scalable application using Ant Design (antd) v5+.

## 1. Design System Foundation

The design system is built on **Ant Design (antd) v5+** and configured via its powerful CSS-in-JS theming engine to provide a cohesive, premium resort/hospitality feel while maintaining the usability required for an admin dashboard.

### Color Palette
The design system uses a vibrant, modern color palette to give the application a fresh and engaging identity:
- **Primary:** Sky Teal (`#3d97bd`). A bright, welcoming teal serving as the main brand color.
- **Secondary / Accent:** Spicy Tangerine (`#f55321`). A bold, energetic orange used for highlights and calls to action.
- **Background / Neutral:** Vanilla Cream (`#fffcd5`). A soft, warm cream color for application backgrounds.
- **Semantic Colors:**
  - **Success/Available:** Vibrant Olive (`#6ca100`)
  - **Info/Pending:** Sky Teal (`#3d97bd`)
  - **Warning/Maintenance:** Spicy Tangerine (`#f55321`)
  - **Dark Accent/Neutral:** Shadow Moss (`#112401`)
  - **Error/Occupied:** Rose Red (`#e11d48`) *(Standard red kept for critical UX error clarity)*

### Typography
- **Font Family:** Inter (sans-serif)
- **Characteristics:** Clean, modern, and highly legible for data-heavy interfaces.

### Theme Configuration (ConfigProvider)
To implement the design tokens, wrap your application in antd's `ConfigProvider`:

```tsx
import { ConfigProvider } from 'antd';

const App = () => (
  <ConfigProvider
    theme={{
      token: {
        colorPrimary: '#3d97bd',
        colorInfo: '#3d97bd',
        colorSuccess: '#6ca100',
        colorWarning: '#f55321',
        colorError: '#e11d48',
        colorBgBase: '#fffcd5',
        fontFamily: '"Inter", sans-serif',
        borderRadius: 8,
      },
      components: {
        Card: {
          borderRadiusLG: 12,
        },
        Modal: {
          borderRadiusLG: 12,
        },
      }
    }}
  >
    <YourApp />
  </ConfigProvider>
);
```

---

## 2. Layout Components

Layout components provide the structural scaffolding for the application.

- **`AppShell`**: The main layout wrapper utilizing antd's `Layout` component (`Layout`, `Layout.Sider`, `Layout.Header`, `Layout.Content`). It manages the state for the responsive sidebar and coordinates the overall screen real estate.
- **`Sidebar`**: Collapsible navigation pane.
  - *Ant Design Base:* `Layout.Sider` and `Menu` with the `items` prop.
  - *Icons:* `@ant-design/icons` (e.g., `HomeOutlined`, `CalendarOutlined`, `UserOutlined`, `BedOutlined`, `TeamOutlined`, `CreditCardOutlined`, `AuditOutlined`).
- **`Header`**: Top navigation bar containing contextual controls.
  - *Ant Design Base:* `Layout.Header` integrating `Breadcrumb`, `Input.Search`, `Avatar`, `Dropdown`, and `Badge` (for notifications).
- **`PageContainer`**: A consistent wrapper for page content to ensure uniform padding and optional max-width constraints.
  - *Ant Design Base:* `@ant-design/pro-components` `PageContainer` (highly recommended) or a custom container div.

---

## 3. Shared Data Components

These components are used across different modules to display and interact with data.

- **`DataTable`**: Reusable complex table.
  - *Features:* Built-in sorting, pagination, filters, row selection, and loading states.
  - *Ant Design Base:* `Table`. Alternatively, use `ProTable` from `@ant-design/pro-components` for an enhanced, data-driven alternative.
- **`DataCard`**: Card-based alternative to tables for mobile views or specific visual requirements.
  - *Ant Design Base:* `Card`.
- **`StatusBadge`**: Colored badges representing various resource states (Available, Occupied, etc.).
  - *Ant Design Base:* `Tag` (with predefined color presets) or `Badge`.
- **`SearchInput`**: A debounced text input with a leading search icon.
  - *Ant Design Base:* `Input.Search`.
- **`FilterBar`**: Composable horizontal bar for filter chips and dropdowns.
  - *Ant Design Base:* `Space` containing `Select`, `DatePicker.RangePicker`, and `Button`s.
- **`Pagination`**: Page navigation controls.
  - *Ant Design Base:* Built into `Table`, or use the standalone `Pagination` component.
- **`EmptyState`**: Friendly display when no data exists.
  - *Ant Design Base:* `Empty` component with custom `description` and action buttons.
- **`LoadingSkeleton`**: Animated skeleton loaders mapped to specific component shapes.
  - *Ant Design Base:* `Skeleton` (e.g., `Skeleton.Input`, `Skeleton.Button`).
- **`ErrorState`**: Error boundary fallback or inline error display with a retry button.
  - *Ant Design Base:* `Result` component with `status="error"`.

---

## 4. Form Components

Form components standardize user input, validation displays, and accessible labeling.

- **`FormField`**: Wrapper providing labels, automatic validation rules, and error message displays.
  - *Ant Design Base:* `Form.Item`.
- **`FormSelect`**: Select dropdown for predefined options.
  - *Ant Design Base:* `Select` inside `Form.Item`.
- **`FormDatePicker`**: Date selector for single dates.
  - *Ant Design Base:* `DatePicker` (antd uses `dayjs` under the hood).
- **`FormDateRangePicker`**: Date range selector for check-in/check-out dates.
  - *Ant Design Base:* `DatePicker.RangePicker`.
- **`FormTextarea`**: Multi-line text input.
  - *Ant Design Base:* `Input.TextArea` inside `Form.Item`.
- **`FormDialog`**: Modal overlay for inline create/edit operations to prevent context switching.
  - *Ant Design Base:* `Modal` or `Drawer` with an embedded `Form`.
- **`ConfirmDialog`**: Alert dialog for destructive actions (e.g., deletions, cancellations).
  - *Ant Design Base:* `Modal.confirm()` utility or the declarative `Popconfirm`.
- **`FormSection`**: Visual grouping for complex forms with a title and optional description.
  - *Ant Design Base:* `Card` or `Divider`.

---

## 5. Feature-Specific Components

Each domain module relies on specialized components composed from the shared foundation.

### Guest
- **`GuestListPage`**: Main view containing antd `Table` or `ProTable` configured for guests.
- **`GuestDetailPage`**: Deep dive into guest history and stats.
- **`GuestForm`**: Create/edit form using antd `Form`, `Input`, `Select`.
- **`GuestCard`**: Summary card for guest profiles using antd `Card`.
- **`GuestSearchSelect`**: Combobox using antd `Select` (with `showSearch` and remote data fetching) for assigning guests to reservations.

### Reservation
- **`ReservationListPage`**: Standard list view using antd `Table`.
- **`ReservationDetailPage`**: Comprehensive view including related payments and charges.
- **`ReservationForm`**: Multi-step or complex form handling dates using antd `Steps`, `Form`, `Select`, and `DatePicker.RangePicker`.
- **`ReservationTimeline`**: Gantt-chart style view of reservations over time.
- **`ReservationStatusFlow`**: Visual indicator of the reservation lifecycle using antd `Steps`.
- **`ReservationSummaryCard`**: Quick overview used in dashboards using antd `Card` and `Descriptions`.

### Room
- **`RoomListPage`**: List of individual rooms using antd `Table`.
- **`RoomDetailPage`**: Room specifics and maintenance history.
- **`RoomForm`**: Create/edit form using antd `Form`.
- **`RoomCard`**: Visual representation of a room using antd `Card`.
- **`RoomAvailabilityGrid`**: Calendar grid showing daily availability.
- **`RoomStatusIndicator`**: Real-time status toggle (Clean, Dirty, Maintenance) utilizing antd `Tag` and `Dropdown`.

### Room Type
- **`RoomTypeListPage`**: Overview of categories.
- **`RoomTypeForm`**: Configuration for capacities, base pricing, and amenities.
- **`RoomTypeCard`**: Display card summarizing amenities and pricing using antd `Card`.

### Employee
- **`EmployeeListPage`**: Staff directory using antd `Table`.
- **`EmployeeDetailPage`**: Staff performance, shift, and audit logs.
- **`EmployeeForm`**: Onboarding/edit form using antd `Form`.
- **`EmployeeCard`**: Directory card using antd `Card` and `Avatar`.
- **`RoleBadge`**: Specialized badge for access levels using antd `Tag`.

### Payment
- **`PaymentListPage`**: Ledger of transactions.
- **`PaymentForm`**: Processing incoming payments.
- **`PaymentSummary`**: Financial breakdown (Subtotal, Taxes, Total) using antd `Descriptions` or `Statistic`.
- **`PaymentMethodBadge`**: Visual indicator for Cash, Card, Transfer using antd `Tag`.
- **`PaymentStatusBadge`**: Paid, Partial, Pending, Refunded using antd `Tag` with preset colors (success, processing, default, warning).

### Additional Charge
- **`ChargeList`**: Inline table typically found within `ReservationDetailPage` using antd `Table`.
- **`ChargeForm`**: Adding incidental charges (e.g., Room Service, Minibar) using antd `Modal` and `Form`.
- **`ChargeSummary`**: Roll-up of extra costs.

### Audit Log
- **`AuditLogListPage`**: System-wide activity tracker using antd `Table`.
- **`AuditLogDetailDialog`**: Deep dive into before/after JSON payloads using antd `Modal`.
- **`AuditLogTimeline`**: Chronological visualization of entity changes using antd `Timeline`.
- **`AuditLogFilterBar`**: Advanced filtering by actor, action type, and date using antd `Space`, `Select`, and `DatePicker`.

### Dashboard
- **`DashboardPage`**: Landing view utilizing `@ant-design/pro-components` `PageContainer`.
- **`StatCard`**: High-level metrics using antd `Statistic` embedded inside a `Card`.
- **`OccupancyChart`**: Bar/Line chart for occupancy rates (Recommend using `@ant-design/charts` or `recharts`).
- **`RecentReservations`**: Condensed list widget using antd `List` or small `Table`.
- **`QuickActions`**: Grid of prominent buttons for common tasks.
- **`RevenueOverview`**: Trend chart for financial data.

---

## 6. Component File Structure Example

Organize features using a domain-driven, feature-based architecture. Here is an example of the `Guest` module structure:

```text
src/
└── features/
    └── guests/
        ├── api/
        │   ├── get-guests.ts          # API hook/fetcher
        │   ├── create-guest.ts
        │   └── update-guest.ts
        ├── components/
        │   ├── guest-list.tsx         # Composes antd Table
        │   ├── guest-detail.tsx
        │   ├── guest-form.tsx         # Uses antd Form
        │   ├── guest-card.tsx
        │   └── guest-search-select.tsx
        ├── hooks/
        │   └── use-guest-filters.ts   # Local UI logic
        ├── types/
        │   └── index.ts               # Guest domain interfaces
        └── index.ts                   # Public API for the feature
```

---

## 7. Component Composition Patterns

To maintain a scalable and manageable codebase, adhere to the following React patterns:

### Container/Presentational Pattern
Separate data fetching from UI rendering.
- **Container (Page or Wrapper):** Handles API calls, state management, and side effects. Passes data and callbacks down.
- **Presentational (Component):** Purely visual, stateless (mostly), receives data via props.
*Example: `GuestListPage` (Container) fetches data and passes it to `GuestList` (Presentational).*

### Compound Components
Use compound components for complex, related UI elements to avoid "prop drilling" and massive configuration objects.
*Example: Reusable `DataCard` wrapping antd's `Card`*
```tsx
<DataCard>
  <DataCard.Header title="Guest Information" action={<Button>Edit</Button>} />
  <DataCard.Content>...</DataCard.Content>
  <DataCard.Footer>...</DataCard.Footer>
</DataCard>
```

### Custom Hooks for Data & Logic
Extract complex business logic, form handling, and API integration into custom hooks.
- **Data Fetching:** `useGuests()`, `useReservation(id)` (using React Query/SWR).
- **UI Logic:** `useGuestFilters()` to manage URL search params and local filter state.
- **Form Logic:** `useGuestForm(initialData)` to configure antd `Form` instances and validation schemas.

---

## 8. Ant Design Component Quick Reference

Use the table below to map common dashboard needs directly to their Ant Design equivalents:

| Need | Ant Design Component |
|------|---------------------|
| Data table | `Table`, `ProTable` |
| Form | `Form`, `Form.Item` |
| Date picker | `DatePicker`, `DatePicker.RangePicker` |
| Select/dropdown | `Select` |
| Modal/dialog | `Modal`, `Drawer` |
| Notifications | `message`, `notification` |
| Loading | `Spin`, `Skeleton` |
| Empty state | `Empty` |
| Error display | `Result` |
| Status indicator | `Tag`, `Badge` |
| Statistics | `Statistic` |
| Layout | `Layout`, `Layout.Sider`, `Layout.Header`, `Layout.Content` |
| Navigation | `Menu` |
| Breadcrumbs | `Breadcrumb` |
| Icons | `@ant-design/icons` |
| Charts | `@ant-design/charts` |
