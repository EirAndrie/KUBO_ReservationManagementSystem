# KUBO Reservation Management System - Frontend UI Specification

## 1. Project Context
- **Project Name:** KUBO Reservation Management System (Frontend)
- **Domain:** Resort Admin Dashboard
- **Tech Stack:** Vite + React + TypeScript + Ant Design (antd)
- **Design Philosophy:** Desktop-first responsive design, focusing on data density and fast workflows for administrative staff.
- **Target Users:** Resort staff including Receptionists, Managers, and System Admins.

This document serves as the comprehensive blueprint for every view within the frontend application. It outlines the required components, data dependencies, and interaction paradigms for each page.

---

## 2. Route Table

| URL Path | Component Name | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `/login` | `LoginPage` | Public | Authentication entry point |
| `/dashboard` | `DashboardPage` | Authenticated | Main overview and metrics |
| `/reservations` | `ReservationListPage` | Authenticated | Data table of all reservations |
| `/reservations/new` | `ReservationFormPage` | Authenticated | Create a new reservation |
| `/reservations/:id` | `ReservationDetailPage` | Authenticated | View specific reservation details |
| `/reservations/:id/edit` | `ReservationFormPage` | Authenticated | Edit existing reservation |
| `/guests` | `GuestListPage` | Authenticated | Data table of all guests |
| `/guests/new` | `GuestFormPage` | Authenticated | Create a new guest profile |
| `/guests/:id` | `GuestDetailPage` | Authenticated | View specific guest history |
| `/guests/:id/edit` | `GuestFormPage` | Authenticated | Edit existing guest |
| `/rooms` | `RoomListPage` | Authenticated | Grid/Table of rooms and current status |
| `/rooms/new` | `RoomFormPage` | Admin/Manager | Add a new physical room |
| `/rooms/:id` | `RoomDetailPage` | Authenticated | View specific room status and history |
| `/rooms/:id/edit` | `RoomFormPage` | Admin/Manager | Edit room details |
| `/room-types` | `RoomTypeListPage` | Admin/Manager | Grid of room categories |
| `/room-types/new` | `RoomTypeFormPage` | Admin/Manager | Add a new room category |
| `/room-types/:id/edit` | `RoomTypeFormPage` | Admin/Manager | Edit room category details |
| `/employees` | `EmployeeListPage` | Admin | Directory of staff members |
| `/employees/new` | `EmployeeFormPage` | Admin | Add new staff member |
| `/employees/:id/edit` | `EmployeeFormPage` | Admin | Edit staff member details |
| `/payments` | `PaymentListPage` | Auth (Billing) | Centralized view of all transactions |
| `/audit-logs` | `AuditLogPage` | Admin | System activity history |
| `*` | `NotFoundPage` | Public | 404 Fallback |

---

## 3. Page Specifications

### 3.1. Login Page (`/login`)
- **Component:** `LoginPage`
- **Layout:** Centered authentication card (`antd Card`) on a subtle resort-themed background or solid color.
- **UI Elements:**
  - System Logo (KUBO).
  - Email input field (with validation via `antd Form.Item`).
  - Password input field (with visibility toggle via `antd Input.Password`).
  - "Sign In" primary button (`antd Button`, shows loading `Spin` on submit).
- **Data Required:** Authentication mutation (`POST /api/auth/login`).
- **Interactions:** Form submission, enter key to submit. Notification on error via `antd message` or `notification`.
- **States:**
  - *Loading:* Button `loading` state active.
  - *Error:* Inline red text below fields for invalid credentials handled by `antd Form`.

### 3.2. Dashboard Page (`/dashboard`)
- **Component:** `DashboardPage`
- **Layout:** Standard dashboard layout using `antd Layout` with `Sider` for navigation, `Header` for top bar, and `Content`. Use `antd Menu` for sidebar items.
- **UI Elements:**
  - **Top Stats Row (4 Cards):** Use `antd Card` wrapping `antd Statistic` components.
    - Total Reservations (Today)
    - Rooms Occupied / Total Rooms (Fraction & Percentage)
    - Check-ins Today
    - Revenue This Month
  - **Occupancy Overview:** Donut chart or bar chart visualizing current room statuses using `@ant-design/charts`.
  - **Recent Reservations:** Compact data table (`antd Table`) showing the last 5-10 reservations with Status Badges (`antd Tag`).
  - **Quick Actions:** Floating or top-aligned button group using `antd Button`. "New Reservation", "New Guest", "Check-in", "Check-out".
  - **Today's Activity:** A vertical timeline component (`antd Timeline`) tracking today's real-time events (check-ins, check-outs, new bookings).
- **Data Required:** `GET /api/dashboard/stats`, `GET /api/dashboard/recent-reservations`, `GET /api/dashboard/activity`.
- **States:**
  - *Loading:* `antd Skeleton` loaders for stat cards, `Spin` for charts.
  - *Empty:* `antd Empty` state with "No activity today" message in the timeline.
- **Responsive:** Stats stack 1x4 on mobile, 2x2 on tablet, 4x1 on desktop. Charts collapse on smaller screens.

---

### 3.3. Reservations Section

#### 3.3a. Reservation List Page (`/reservations`)
- **Component:** `ReservationListPage`
- **UI Elements:**
  - **Header:** Title and "New Reservation" primary `antd Button` with `@ant-design/icons`. Use `antd Breadcrumb` for navigation context.
  - **Filters Bar:**
    - Search input (`antd Input.Search` by Guest Name or Reservation ID).
    - Status multi-select dropdown (`antd Select` with `mode="multiple"` for All, Pending, Confirmed, Checked In, Checked Out, Cancelled).
    - Date range picker (`antd DatePicker.RangePicker` for Check-in dates).
  - **Data Table:** Use `@ant-design/pro-components ProTable` or `antd Table` with built-in sorting and filtering.
    - Columns: ID, Guest Name, Room, Check-in Date, Check-out Date, Status (Color-coded `antd Tag`), Total Amount, Actions (Dropdown menu: View, Edit, Cancel).
  - **Footer:** Built-in `antd Table` pagination controls (Previous/Next, Page numbers, Items per page selector 10/20/50).
  - **Bulk Actions:** "Export to CSV" `antd Button`.
- **Data Required:** `GET /api/reservations` (paginated, with query params for filters).
- **Interactions:** Sorting by clicking column headers.
- **States:** `antd Empty` state with "No reservations found" illustration if filters yield zero results.

#### 3.3b. Reservation Detail Page (`/reservations/:id`)
- **Component:** `ReservationDetailPage`
- **UI Elements:**
  - **Header:** Reservation ID `#RES-XXXX`, large Status `antd Tag`.
  - **State Transitions:** Action `antd Button`s based on current status (e.g., "Confirm", "Check In", "Check Out", "Cancel"). Destructive actions should use `antd Popconfirm`.
  - **Grid Layout (2 Columns on Desktop):**
    - *Column 1 (Details):*
      - **Guest Info Card:** `antd Card` using `antd Descriptions` (Name, Email, Phone, Link to `GuestDetailPage`).
      - **Room Info Card:** `antd Card` using `antd Descriptions` (Room number, Room Type, Floor).
      - **Stay Details Card:** `antd Card` using `antd Descriptions` (Check-in/out dates, Duration, Base Rate).
    - *Column 2 (Financials & Logs):*
      - **Financial Summary Card:** Base cost + Extra charges = Total Amount.
      - **Payment Section:** `antd Table` of payments (Date, Method, Amount, Status). "Add Payment" button opening an `antd Modal`.
      - **Additional Charges Section:** List of incidentals. "Add Charge" button.
  - **Audit Trail:** `antd Timeline` or `antd Collapse` showing timeline of changes (e.g., "Created on X", "Status changed to Confirmed by User Y").
  - **Top Actions:** Edit Reservation, Print Invoice.
- **Data Required:** `GET /api/reservations/:id`, `GET /api/reservations/:id/payments`, `GET /api/reservations/:id/logs`.
- **Interactions:** Status update modals (`antd Modal` or `Popconfirm` before checking in/out). Notifications via `antd message` on success/error.

#### 3.3c. Reservation Form (`/reservations/new`, `/reservations/:id/edit`)
- **Component:** `ReservationFormPage`
- **UI Elements:**
  - **Wizard/Multi-step or Long Scroll Form:** `antd Steps` to track progress or a standard `antd Form`.
  - **Guest Selection:** Async `antd Select` with `showSearch`. Include an "Add New Guest" inline button that expands a sub-form or opens an `antd Modal`.
  - **Date Selection:** Linked `antd DatePicker.RangePicker`. Must validate minimum 1 night and block past dates using `disabledDate`.
  - **Room Selection:** `antd Select` for Room Type, followed by a dynamically populated list of *Available Rooms* for the selected dates.
  - **Notes:** `antd Input.TextArea` for special requests.
  - **Summary Sidebar (Sticky):** Real-time calculation: `(Base Price * Nights) + Fixed Charges = Total`.
  - **Footer:** Cancel `antd Button`, Submit primary `antd Button`.
- **Data Required:** `GET /api/guests/search`, `GET /api/rooms/available?checkIn=X&checkOut=Y`. Mutation: `POST /api/reservations` or `PUT /api/reservations/:id`.
- **States:** Extensive form validation (`antd Form.Item` rules) displaying inline red error messages.

---

### 3.4. Guests Section

#### 3.4a. Guest List Page (`/guests`)
- **Component:** `GuestListPage`
- **UI Elements:**
  - **Search:** Global search bar (`antd Input.Search` for Name, Email, Phone).
  - **Data Table:** `antd Table` (ID, Full Name, Email, Phone, Total Reservations, Last Visit, Actions).
  - **Header:** "New Guest" `antd Button`.
  - Pagination controls integrated into the table.
- **Data Required:** `GET /api/guests`.

#### 3.4b. Guest Detail Page (`/guests/:id`)
- **Component:** `GuestDetailPage`
- **UI Elements:**
  - **Profile Card:** `antd Card` with `antd Avatar`, Full Name, Email, Phone, Registration Date shown via `antd Descriptions`.
  - **Metrics Row:** `antd Row` and `Col` with `antd Statistic` (Total Spend, Total Stays, Cancelled Bookings).
  - **Reservation History:** `antd Table` of past and upcoming reservations for this specific guest.
  - **Actions:** Edit Profile, Delete Guest (danger `antd Button`, requires `antd Popconfirm` for confirmation).
- **Data Required:** `GET /api/guests/:id`, `GET /api/guests/:id/reservations`.

#### 3.4c. Guest Form (`/guests/new`, `/guests/:id/edit`)
- **Component:** `GuestFormPage`
- **UI Elements:**
  - Standard `antd Card`-based `antd Form`.
  - Fields (`Form.Item`): First Name, Last Name, Email, Phone Number, Address (optional), ID/Passport Number (optional).
  - Validation rules configured in `Form.Item` for email format and phone numbers.
- **Data Required:** `POST /api/guests` or `PUT /api/guests/:id`.

---

### 3.5. Rooms Section

#### 3.5a. Room List Page (`/rooms`)
- **Component:** `RoomListPage`
- **UI Elements:**
  - **View Toggle:** `antd Tabs` or `antd Radio.Group` to switch between "Grid View" and "Table View".
  - **Filters:** Room Type `antd Select`, Status `antd Select` (Available, Occupied, Maintenance), Floor selector.
  - **Grid View:** `antd Card` components representing physical rooms. Colored top border or background indicating status using `antd Tag` colors (Green=Available, Red=Occupied, Yellow=Maintenance). Shows Room No., Type, and quick action context menu.
  - **Table View:** Standard `antd Table` format.
  - **Header:** "New Room" `antd Button`.
- **Data Required:** `GET /api/rooms`.

#### 3.5b. Room Detail Page (`/rooms/:id`)
- **Component:** `RoomDetailPage`
- **UI Elements:**
  - **Room Profile:** `antd Descriptions` (Number, Type, Floor, Max Occupancy).
  - **Status Card:** Current status with prominent toggle buttons (e.g., "Mark as Maintenance").
  - **Schedule:** Mini-calendar (`antd Calendar`) or list of upcoming reservations for this specific room.
  - **Maintenance History:** Log of past maintenance activities using `antd Timeline`.
- **Data Required:** `GET /api/rooms/:id`, `GET /api/rooms/:id/schedule`.

#### 3.5c. Room Form (`/rooms/new`, `/rooms/:id/edit`)
- **Component:** `RoomFormPage`
- **UI Elements:**
  - Fields inside `antd Form`: Room Number (`antd Input`), Room Type (`antd Select`), Floor (`antd InputNumber` or `Select`), Status (`antd Select`).
- **Data Required:** `GET /api/room-types` (for dropdown). `POST` or `PUT` endpoints.

---

### 3.6. Room Types Section

#### 3.6a. Room Type List Page (`/room-types`)
- **Component:** `RoomTypeListPage`
- **UI Elements:**
  - **Card Grid Layout:** Each room type is displayed as a detailed `antd Card` within an `antd Row` and `Col` grid.
  - **Card Content:** Name, Description, Base Price, Max Occupancy (icon + number), Amenities (small `antd Tag` components).
  - Actions inside card: Edit `antd Button`.
  - **Header:** "New Room Type" `antd Button`.
- **Data Required:** `GET /api/room-types`.

#### 3.6b. Room Type Form (`/room-types/new`, `/room-types/:id/edit`)
- **Component:** `RoomTypeFormPage`
- **UI Elements:**
  - Fields inside `antd Form`: Name, Description (`antd Input.TextArea`), Base Price (`antd InputNumber` with formatter for Currency), Max Occupancy (`antd InputNumber`).
  - **Amenities:** `antd Select` with `mode="tags"` component (type and press enter to add tags like "WiFi", "AC", "Pool View").
- **Data Required:** `POST` or `PUT` endpoints.

---

### 3.7. Employees Section

#### 3.7a. Employee List Page (`/employees`)
- **Component:** `EmployeeListPage`
- **UI Elements:**
  - **Filters:** Role `antd Select` (Admin, Receptionist, Housekeeping, Manager), Status `antd Select` (Active, Inactive).
  - **Data Table:** `antd Table` (ID, Full Name, Email, Role `antd Tag`, Status `antd Tag`, Actions).
  - **Header:** "New Employee" `antd Button`.
- **Data Required:** `GET /api/employees`.

#### 3.7b. Employee Form (`/employees/new`, `/employees/:id/edit`)
- **Component:** `EmployeeFormPage`
- **UI Elements:**
  - Fields inside `antd Form`: First Name, Last Name, Email (used for login), Phone, Role (`antd Select`).
  - Status Toggle: Active/Inactive `antd Switch`.
- **Data Required:** `POST` or `PUT` endpoints.

---

### 3.8. Payments Section

#### 3.8a. Payment List Page (`/payments`)
- **Component:** `PaymentListPage`
- **UI Elements:**
  - **Summary Cards (Top):** `antd Card` wrapping `antd Statistic` (Total Revenue, Pending Payments, Completed Today).
  - **Filters:** Payment Method `antd Select`, Status `antd Select`, Date `antd DatePicker.RangePicker`.
  - **Data Table:** `antd Table` (Payment ID, Reservation ID, Amount, Method `antd Tag` with `@ant-design/icons`, Status `antd Tag`, Date, Actions).
- **Data Required:** `GET /api/payments`.
- **Note:** This page is strictly a ledger view. Payments are usually created from within a Reservation Detail page.

---

### 3.9. Audit Logs Section

#### 3.9a. Audit Log Page (`/audit-logs`)
- **Component:** `AuditLogPage`
- **UI Elements:**
  - **Filters:** Entity Type `antd Select`, Action `antd Select`, Date Range `antd DatePicker.RangePicker`, Performed By User `antd Select`.
  - **Data Table:** `antd Table` (Timestamp, Entity Type, Entity ID, Action, Performed By, Details).
  - **Details Column:** Collapsible/Expandable row feature in `antd Table` showing what exactly changed.
  - **Actions:** "Export Logs" `antd Button`.
- **Data Required:** `GET /api/audit-logs`.
- **Security:** Read-only interface. No forms or edit capabilities.

---

### 3.10. 404 Not Found Page
- **Component:** `NotFoundPage`
- **UI Elements:**
  - Centered layout using `antd Result` component.
  - Friendly, stylized illustration (e.g., `status="404"`).
  - Large "404 - Page Not Found" text as the `title`.
  - Helpful subtext as `subTitle` ("The page you are looking for doesn't exist or has been moved.").
  - **Action:** Primary "Back to Dashboard" `antd Button` passed as `extra`.
- **Responsive:** Image scales down on mobile, typography adjusts.

---
*End of Specification Document*
