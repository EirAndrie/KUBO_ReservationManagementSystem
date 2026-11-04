# KUBO Reservation Management System Frontend

Use this entire document as the design brief for Figma Make. Generate a high-fidelity,
interactive, desktop-first admin dashboard prototype for the **KUBO Reservation
Management System**. Do not invent entities, fields, roles, or workflows outside this
brief.

This is a **UI-only design brief**. Do not include endpoint paths, HTTP methods,
request/response payloads, status codes, database schemas, or API contracts. Design
the screens, states, interactions, and navigation only.

The prototype must reflect the real resort domain: **kubos**, **kubo types**, guest
records, reservations, reserved-kubo assignments, additional charges, payments, employees,
roles, and audit logs.

---

## 1. Product context

**Product:** KUBO Reservation Management System  
**Type:** Internal resort operations and administration dashboard  
**Primary users:** Resort Administrator and Staff  
**Design approach:** Desktop-first responsive admin dashboard, data-dense but calm, fast
for daily operations.

The system supports:

- Guest registration and retrieval.
- Reservation creation and lifecycle management.
- Kubo availability checking and assignment.
- Per-kubo assignment changes, check-in, early check-in approval, and check-out.
- Additional charges: catalog application and custom requests.
- Payments, payment status updates, and refunds.
- Employee and role administration.
- Kubo type, kubo, and nightly-rate configuration.
- Audit-log and entity-history review.

---

## 2. Canonical terminology and overrides

Some older frontend planning documents use “Room” and “Room Type.” For this prototype,
use the real domain terminology.

| Use this | Not this |
|---|---|
| Kubo | Room |
| Kubo Type | Room Type |
| Kubo Number | Room Number |
| Kubo Status | Room Status |
| Reserved Kubo | Room Assignment |
| Price per Night | Base Price / Rate |

Additional overrides:

- Use **Kubo** and **Kubo Type** everywhere in navigation, labels, tables, and forms.
- Do **not** add amenities, floor numbers, taxes, discounts, party size, shift schedules,
  or stored report tables. The schema does not contain them.
- Employee accounts use a **username**, not an email address, for sign-in.
- Roles are only **Administrator** and **Staff**. Do not use Receptionist, Manager,
  Housekeeping, or System Admin.
- Additional charges use a **catalog** plus applied reservation charges. Catalog items
  have a `unit_price`; applied charges have quantity, unit amount, and total amount.
- Administrators manage the catalog and approve custom requests. They do not apply
  routine charges or edit/delete applied charges.
- Staff apply active catalog items or submit custom `Other` requests for approval.
- A reservation has no header-level stay dates. Each reserved-kubo assignment carries
  its own check-in date, check-out date, and optional scheduled times.
- Date edits on an existing assignment re-price that assignment at the kubo type’s
  current nightly rate. Rate changes alone do not alter existing assignments.
- Payments are recorded as `Pending`, then move through system-managed statuses.
  Refunds are separate completed records linked to an original payment.
- `Adjustment` and `Reversal` are display-only values. Do not offer them as user
  actions; the implemented flow supports payments and refunds only.
- The financial summary labels `charges_total` as **Grand Total**: accommodation plus
  additional charges.

---

## 3. Roles, navigation, and permissions

### Administrator

Navigation:

- Dashboard
- Reservations — read-only review
- Kubos — manage inventory
- Kubo Types & Rates — manage
- Employees — manage
- Roles — manage
- Payments — review; cleanup deletion for repair only
- Additional Charges — catalog management, custom request review, applied charge review
- Audit Logs — read-only review

Administrator restrictions:

- Must not create, edit, cancel, or mark no-show reservations.
- Must not check guests in or out.
- Must not apply routine catalog charges or record operational payments/refunds.
- Must not create or edit guest records.
- Can view reservation, assignment, charge, payment, and balance information read-only.
- Can manage the charge catalog, approve/reject/adjust custom requests, and record
  additive corrections to applied charges.
- May use payment cleanup deletion only as an explicit repair action, with a strong
  warning that it does not repair the financial history.
- Can view audit logs and entity history.

### Staff

Navigation:

- Dashboard
- Guests
- Reservations
- Kubos / Availability
- Payments
- Additional Charges — apply catalog charges or submit custom requests via reservation detail
- Reservation assignments — add, edit, remove, check in, approve early check-in, and check out per kubo

Staff restrictions:

- Must not manage employees, roles, kubo types, kubos, nightly rates, or the charge catalog.
- Must not view audit logs.
- Must not approve, reject, adjust, or correct charges.
- Must not clean up-delete payments.
- Can register and update guests.
- Can create, modify, cancel, confirm, and manage reservations.
- Can check availability and assign kubos.
- Can edit or remove reserved assignments while the reservation is `Pending` or
  `Confirmed` and the assignment is `Reserved`.
- Can apply active catalog charges, delete applied charges before settlement, submit
  custom `Other` requests, and record payments/refunds.
- Can approve early check-in for an assignment, check guests in and out per kubo, and
  update payment status through allowed transitions.

Use role-aware navigation and hide forbidden actions. If one prototype needs a role
switcher for demonstration, label it clearly as **“Prototype role preview”** and do not
treat it as a production feature.

---

## 4. Route and screen map

| Route | Screen | Access |
|---|---|---|
| `/login` | Login | Public |
| `/dashboard` | Role-aware dashboard | Both |
| `/guests` | Guest list | Staff |
| `/guests/new` | Create guest | Staff |
| `/guests/:id` | Guest detail | Staff |
| `/guests/:id/edit` | Edit guest | Staff |
| `/reservations` | Reservation list | Both; Admin read-only |
| `/reservations/new` | Create reservation | Staff |
| `/reservations/:id` | Reservation detail | Both; Admin read-only |
| `/reservations/:id/edit` | Edit reservation | Staff |
| `/kubos` | Kubo inventory / availability | Both; Admin manages, Staff assigns |
| `/kubo-types` | Kubo types and rates | Administrator |
| `/employees` | Employee directory | Administrator |
| `/roles` | Role management | Administrator |
| `/payments` | Payment ledger | Both; Staff records and updates, Admin reviews |
| `/payments/:id` | Payment detail and actions | Both; role-aware |
| `/additional-charges` | Applied charge review and corrections | Administrator |
| `/additional-charges/catalog` | Charge catalog management | Administrator |
| `/additional-charges/requests` | Custom charge request review | Administrator |
| `/audit-logs` | Audit log | Administrator |
| `*` | 404 page | Public |

---

## 5. Design direction

### Visual style

- Premium resort-hospitality feel with a clean enterprise dashboard structure.
- Ant Design v5-inspired components and patterns.
- Desktop-first, responsive down to tablet and mobile.
- Generous but efficient spacing for data-heavy screens.
- Rounded cards, clear hierarchy, restrained shadows.

### Design tokens

| Token | Value |
|---|---|
| Primary | Sky Teal `#3D97BD` |
| Accent / warning | Spicy Tangerine `#F55321` |
| Background | Vanilla Cream `#FFFCD5` |
| Success / available | Vibrant Olive `#6CA100` |
| Dark neutral | Shadow Moss `#112401` |
| Error / occupied | Rose Red `#E11D48` |
| Surface | White / warm off-white |
| Font | Inter |
| Base radius | 8px |
| Card/modal radius | 12px |

### Layout

- Left collapsible sidebar.
- Top header with breadcrumb, search, notifications, and user menu.
- Main content area with page title, actions, filters, and content.
- Sticky action bars where appropriate.
- Tables should support sorting, filtering, pagination, empty/loading/error states, and
  row actions.

### Currency and dates

- Currency: Philippine pesos, displayed as `₱1,250.00`.
- Dates: `MMM DD, YYYY`.
- Times: `hh:mm A`.
- All monetary values show two decimals.

---

## 6. Global shell

Include:

- KUBO brand mark/wordmark.
- Role-aware sidebar with icons.
- Collapsed and expanded sidebar states.
- Header breadcrumb, global search, notification badge, and avatar dropdown.
- User menu with profile, role label, and sign out.
- Responsive mobile drawer navigation.
- Page container with title, description, primary action, and optional secondary actions.
- Toast notifications for success and error.
- Confirmation dialogs for destructive or state-changing actions.
- Loading skeletons, `Empty` states, and error states with retry actions.
- Accessible focus states and keyboard navigation.

---

## 7. Shared components

Create reusable components:

- `StatusTag` for reservation, kubo, employee, and payment statuses.
- `MoneyText` for PHP amounts.
- `PageHeader` with title, breadcrumb, actions.
- `FilterBar` with search, select filters, and date range.
- `DataTable` with pagination and empty state.
- `EntitySummaryCard`.
- `DetailDescriptions`.
- `ConfirmActionModal`.
- `FormDrawer` / `FormModal`.
- `AuditTimeline`.
- `StatCard`.
- `RoleBadge`.
- `KuboStatusBadge`.
- `PaymentStatusBadge`.
- `ReservationStatusBadge`.
- `AssignmentStatusBadge`.
- `ChargeRequestStatusBadge`.
- `SettlementNotice`.
- `BalanceGateBanner`.
- `EarlyCheckInBadge`.
- `EntityHistoryDrawer`.
- `ChargeTypeTag`.
- `PhoneText` showing both accepted formats.
- `GuestIdentityCard` showing ID type and ID number.
- `DerivedBalanceSummary`.

Use accessible labels, semantic headings, visible focus rings, and keyboard-friendly
controls.

---

## 8. Screen specifications

### 8.1 Login

- Centered card on a subtle resort-themed background.
- KUBO logo and short product name.
- Fields: **Username**, **Password**.
- Password visibility toggle.
- “Sign In” primary button with loading state.
- Inline error for invalid credentials.
- Do not use an email field. Employee sign-in uses username.
- Do not include a role selector. The role comes from the employee record.

### 8.2 Dashboard

Create separate Staff and Administrator variants.

Staff dashboard:

- Stats: reservations today, kubos occupied vs total, check-ins today, revenue this month.
- Occupancy overview chart by kubo status.
- Today’s arrivals and departures.
- Recent reservations table.
- Quick actions: New Reservation, New Guest, Today’s Arrivals, Outstanding Balances.
- Today’s activity timeline.

Administrator dashboard:

- Stats: active employees, kubo utilization, charges recorded this month, payments summary.
- Read-only reservation overview.
- Additional-charge request and applied-charge review summary.
- Quick actions: Manage Employees, Manage Kubo Types, Review Charge Requests, View Audit Log.

Use mock data. Dashboard metrics are illustrative; no analytics or reporting screen is
part of this prototype.

### 8.3 Guest list

Table columns:

- Guest name
- Email
- Phone
- ID type
- ID number
- Updated at
- Actions

Filters:

- Search by name, email, or phone.
- ID type filter using exact database enum labels.
- Pagination.

Actions:

- New Guest.
- View.
- Edit.
- Delete — Administrator only, and only for unused guests. In the Staff flow, do not show
  the delete action.

Show an empty state: “No guests match your filters.”

### 8.4 Guest detail

Cards:

- Profile card: name, email, phone, address, ID type, ID number.
- Derived stats: total stays, total spend, cancelled reservations.
- Reservation history table for this guest.

Actions:

- Edit.
- Delete — Administrator only, disabled with explanatory tooltip when the guest has
  reservations.

### 8.5 Guest form

Fields:

- First name — required, max 100.
- Last name — required, max 100.
- Email — required, valid email, max 100.
- Phone — required, must match `09XXXXXXXXX` or `+639XXXXXXXXX`.
- Valid ID type — required, exact database enum.
- ID number — required, max 50.
- Address line 1 — optional.
- City — optional.
- State/Province — optional.
- ZIP/Postal code — optional.
- Country — optional.

Behavior:

- Search existing guest by email before creating; if found, show a “Guest already exists”
  banner with the existing guest and a “Use existing guest” action.
- Creating a guest with an existing email or ID pair should reuse the existing guest, not
  create a duplicate.
- Editing can change name, email, phone, address, and ID details. This supports a guest
  who changed their ID or surname.
- Show a success toast: “Guest created”, “Existing guest reused”, or “Guest updated”.

### 8.6 Reservation list

Columns:

- Reference code.
- Guest name.
- Kubo assignments (kubo numbers, or “Multiple” with a count).
- Stay window (earliest assignment check-in to latest check-out).
- Reservation status.
- Outstanding balance.
- Actions.

Filters:

- Search by reference code, guest name, or employee name.
- Reservation status.
- Booking source.
- Guest.
- Creating employee.
- Assigned-stay date range (contained within the selected dates).
- Pagination.

Actions:

- New Reservation — Staff only.
- View.
- Edit — Staff only, and only when status is `Pending` or `Confirmed`.
- Confirm — Staff only, `Pending` reservations.
- Cancel — Staff only, `Pending` or `Confirmed`, with a required reason.
- Mark No-Show — Staff only, `Confirmed` reservations after the scheduled check-in
  date/time has passed.
- Repair delete — Staff only, in a clearly separated danger action. Disabled when the
  reservation has payments, additional charges, or custom charge-request history.
- Do not put reservation-level Check In / Check Out here. Open the detail screen and
  act on each kubo assignment.

### 8.7 Reservation form

The reservation header contains only the guest, booking source, and initial status.
Stay dates belong to each kubo assignment.

Sections:

1. Guest
   - Search by name, email, or phone.
   - Reuse an existing guest.
   - Open “Add New Guest” drawer.
2. Reservation header
   - Booking source.
   - No party-size field.
   - No reservation-level check-in/check-out dates.
3. Kubo assignments
   - At least one assignment is required.
   - “Add Kubo” opens an availability picker.
   - Pick a kubo type and a check-in/check-out range for that assignment.
   - Show only kubos that are bookable for that range:
     - Exclude `Maintenance`, `OutOfService`, and `UnderInspection`.
     - Exclude `Cleaning` when check-in is today.
     - `Available`, `Reserved`, and `Occupied` kubos may appear when they have no
       overlapping active assignment.
   - Each added assignment shows: kubo number, type, nightly price, nights, total,
     check-in date, check-out date, optional scheduled check-in/out times.
   - Validate that check-out is later than check-in and check-in is not in the past.
   - Scheduled times are optional, but when both are entered the check-out time must
     be later than the check-in time.
   - Allow multiple assignments with independent date ranges.
4. Review
   - Guest summary.
   - Booking source.
   - Assignment list with per-assignment dates and price.
   - Price breakdown.
   - Confirm and create as `Pending`.

Sticky summary sidebar:

- Accommodation total.
- Additional charges subtotal.
- Grand total (accommodation + additional charges).
- Net paid.
- Outstanding balance.

### 8.8 Reservation detail

Header:

- Reference code.
- Reservation status tag.
- Guest name.
- Actions based on role and status.
- Administrator read-only banner: “Administrators have read-only access to
  reservations.”

Cards:

- Guest information card with link to guest detail.
- Reservation summary: booking source, creating employee, reserved date, status.
- Assigned kubos table:
  - Kubo number, kubo type, assignment status, check-in/check-out dates, scheduled
    times, actual check-in/out timestamps, early-check-in flag, nightly price, nights,
    amount, actions.
- Financial summary:
  - Accommodation total.
  - Additional charges subtotal.
  - Grand total (accommodation + additional charges).
  - Net paid.
  - Outstanding balance.
- Additional charges table with role-aware actions.
- Payments table with role-aware actions.
- Audit history drawer/button for Administrators only.

Assignment actions (Staff):

- Add assignment — reservation `Pending` or `Confirmed`.
- Edit assignment dates/times — reservation `Pending` or `Confirmed`, assignment
  `Reserved`. Warn that changing dates re-prices the assignment at the current rate.
- Remove assignment — reservation `Pending` or `Confirmed`, assignment `Reserved`;
  disable when it is the last remaining assignment.
- Approve early check-in — reservation `Confirmed` or `CheckedIn`, assignment
  `Reserved`. This only sets the approval flag; it does not check the guest in.
- Check in — reservation `Confirmed` or `CheckedIn`, assignment `Reserved`. Require
  early approval when checking in before the scheduled date. Block when the kubo is
  not `Available` or `Reserved`, or when the check-out date has been reached.
- Check out — reservation `CheckedIn`, assignment `CheckedIn`. Block while the
  outstanding balance is not exactly zero. On success, show the kubo moving to
  `Cleaning`; when no active assignments remain, show the reservation as `CheckedOut`.

Reservation status actions (Staff):

- Confirm — `Pending` only.
- Cancel — `Pending` or `Confirmed`, with a required reason.
- Mark No-Show — `Confirmed` only, after the earliest scheduled check-in date/time has
  passed.
- Repair delete — separated danger action. Disable when the reservation has payments,
  additional charges, or custom charge-request history.

### 8.9 Kubo inventory / availability

Views:

- Grid view of kubo cards.
- Table view.

Kubo card:

- Kubo number.
- Kubo type.
- Status tag.
- Current or next assignment if available.
- Quick actions for Administrators: Edit, Change Status.

Filters:

- Kubo type.
- Status.
- Availability date range for Staff assignment.

Statuses:

- Available
- Reserved
- Occupied
- Maintenance
- OutOfService
- Cleaning
- UnderInspection

Administrator actions:

- Create kubo. Initial status may only be `Available`, `Maintenance`, or
  `OutOfService`.
- Edit kubo number or kubo type.
- Change status through the allowed transitions:
  - `Available` → `Reserved`, `Occupied`, `Cleaning`, `Maintenance`,
    `UnderInspection`, `OutOfService`
  - `Reserved` → `Occupied`, `Available`, `Maintenance`, `UnderInspection`,
    `OutOfService`
  - `Occupied` → `Cleaning`, `Maintenance`, `UnderInspection`, `OutOfService`
  - `Cleaning` → `Available`, `Maintenance`, `UnderInspection`, `OutOfService`
  - `Maintenance` → `Available`
  - `UnderInspection` → `Available`
  - `OutOfService` → `Available`
  - Selecting the current status is a no-op.
- Delete only when the kubo has no assignment history; otherwise offer “Set
  OutOfService.”
- Do not expose status directly in the edit form; use a separate Change Status action.

Staff actions:

- View availability.
- Assign available kubos to a reservation.
- Do not manage kubo inventory.

Kubo status also changes automatically through reservation flows: assignment can set
`Reserved`, check-in sets `Occupied`, check-out sets `Cleaning`, and cancellation or
deletion may release the kubo to `Available`.

### 8.10 Kubo types and rates

Card grid:

- Type name.
- Capacity.
- Price per night.
- Description.
- Number of kubos using this type (derived from the kubo inventory view).
- Actions: Edit, Delete if unreferenced.

Form:

- Type name — required, unique.
- Capacity — required, greater than zero.
- Price per night — required, non-negative, two decimals.
- Description — optional.

Rate-change behavior:

- Show a note: “Changing the nightly rate does not change price_at_booking on existing
  reservations.”
- Editing an assignment’s dates re-prices that assignment at the current nightly rate.
- New assignments use the new rate.
- Kubo types cannot be deactivated; they can only be deleted when no kubo uses them.

Administrator only.

### 8.11 Employees

List columns:

- Full name.
- Username.
- Role tag.
- Status tag.
- Created at.
- Actions.

Filters:

- Search by name or username.
- Role.
- Status.

Form:

- First name.
- Last name.
- Username.
- Password — create only, 8–12 characters with uppercase, lowercase, number, and one
  of `@ $ ! % * ? &`.
- Role.
- Status.

Do not include employee email, phone, address, shift, or attendance fields. Never show
or return a password hash.

Actions:

- Create employee.
- Edit profile. Password is not editable here.
- Reset password in a separate modal.
- Change status.
- Delete only when the employee has no reservations, payments, charges, or audit
  history. In practice, most employees cannot be deleted; prefer `Inactive` or
  `Terminated`.

Business-rule messaging:

- Only one Active Administrator is allowed.
- The last Active Administrator cannot be deactivated, reassigned, or deleted.
- Show clear inline errors for these cases.
- Explain that deleted employees are not recoverable and that history-bearing
  employees must be retained.

### 8.12 Roles

List:

- Role name.
- Description.
- Number of employees assigned.
- Actions.

Actions:

- Create role.
- Rename role.
- Delete role only when no employees reference it.

Do not allow deletion of a role that has assigned employees. Show a blocking dialog:
“Reassign employees before deleting this role.”

Administrator only.

### 8.13 Payments

Ledger table:

- Payment ID.
- Reservation reference.
- Transaction type (`Payment` or `Refund`).
- Payment type.
- Method.
- Amount.
- Status.
- Payment date.
- Recorded by.
- Actions.

Filters:

- Reservation.
- Recorded by / employee.
- Transaction type.
- Payment status.
- Payment method.
- Date range.

Payment form (Staff, launched from reservation detail):

- Amount — non-negative, two decimals.
- Payment type: `Deposit`, `PartialPayment`, `FullPayment`, `BalancePayment`,
  `AdditionalCharge`.
- Payment method: `Cash`, `CreditCard`, `DebitCard`, `GCash`, `Maya`, `BankTransfer`,
  `OnlineBanking`, `Other`.
- Do not show a transaction-type selector. The action records a `Payment`.
- Status is system-managed: new payments start as `Pending`.
- Show the derived balance summary near the form.
- Block amounts above the outstanding balance and show the current balance.

Payment status actions (Staff):

- `Pending` → `Processing`, `Completed`, `Failed`, `Cancelled`
- `Processing` → `Completed`, `Failed`, `Cancelled`
- `Completed`, `PartiallyRefunded`, `Refunded`, `Failed`, and `Cancelled` have no
  manual outgoing transitions.
- Completing a payment re-checks the outstanding balance; show the same overpayment
  warning if it no longer fits.
- Selecting the current status is a no-op.

Refund form (Staff):

- Select an original payment from the same reservation that is `Completed` or
  `PartiallyRefunded`.
- Amount must be positive, at most two decimals, and no more than the net amount paid.
- Payment type and method are required.
- The refund is created as a completed `Refund` record with a positive amount.
- Show the original payment’s status updating to `PartiallyRefunded` or `Refunded`.
- Refunds are allowed even when the reservation is cancelled or marked no-show, as
  long as the original payment is valid.

Administrator:

- Reviews the ledger.
- May use “Cleanup delete” in a clearly marked repair-only danger action, with a
  warning that it does not recalculate the ledger or restore refunded payments.
- Do not offer Adjustment or Reversal creation.

### 8.14 Additional charges

#### Administrator: charge catalog

- Catalog table/cards:
  - charge type
  - display name (for example, “Extra Pillow”)
  - description
  - standard unit price
  - active/inactive status
  - usage count
- Actions: Create, Edit, Activate/Deactivate, Delete unused.
- Form fields: charge type, name, description, unit price, active.
- Provide an explicit “Clear description” control. Blank text does not clear an
  existing description.
- Do not permit deletion when the item has been applied; deactivate instead.
- Catalog edits do not alter previously applied charges.
- No rate field on applied charges; unit price belongs to the catalog.

#### Staff: apply catalog charge

Inside reservation detail:

- “Apply Charge” button opens the active catalog picker.
- Only active catalog items can be applied.
- Select item.
- Enter quantity (positive integer).
- Show calculated total = quantity × catalog unit price.
- Staff cannot override the catalog price.
- Charge date is system-generated.
- The applied charge uses the catalog name as its description.
- Applied charge appears immediately in the reservation total.
- Eligible reservation statuses: `Pending`, `Confirmed`, `CheckedIn`, `CheckedOut`.
- Applying a new charge remains possible after settlement; only deletion is blocked.

#### Staff: custom “Other” request

- “Request Custom Charge” action.
- Charge type is fixed to `Other`.
- Required description, maximum 255 characters.
- Quantity.
- Proposed unit amount.
- Submit creates a `Pending` request.
- Pending request does **not** change the reservation balance.
- Show a clear “Awaiting Administrator review” state.
- The submitting Staff member may withdraw a `Pending` request. Withdrawn and
  rejected requests remain visible for history.

#### Administrator: custom request review

- Request queue filters: status, reservation, requested by.
- Table columns: request ID, reservation, guest, requested by, description, quantity,
  proposed unit amount, approved unit amount, status, submitted at, reviewed at.
- Review drawer:
  - Approve with the proposed amount.
  - Approve with an adjusted unit amount and required reason.
  - Reject with a required reason.
  - Only `Pending` requests can be approved or rejected.
  - On approval, create the applied charge and refresh the balance.
  - On rejection or withdrawal, no charge is created.
- Show the applied charge under the requesting Staff employee, not the reviewing
  Administrator.

#### Applied-charge review

- Filters: reservation, employee, charge type, date range.
- Table columns: reservation, guest, charge name/type, quantity, unit amount, total,
  recorded by, charge date.
- Staff actions: View, Delete before settlement.
- Administrator actions: View, Record Correction.
- No Edit action for applied charges.
- Correction is additive only: create a new additional charge with a reason. The
  original charge is never edited or deleted.
- There is no implemented reduction flow. Do not show Adjustment or Reversal actions.
- Show: “Existing charges are append-only. Corrections create new records.”
- Settlement means the reservation is `CheckedOut`, `Cancelled`, or `NoShow`, or any
  payment/refund has completed. Disable Delete after settlement and explain why.

### 8.15 Audit log

Read-only table:

- Timestamp.
- Actor/employee.
- Action.
- Entity type.
- Entity ID.
- Description.
- Expandable old/new values.

Filters:

- Employee.
- Action.
- Entity type.
- Entity ID.
- Date range.

Actions:

- View details.
- No create, edit, or delete actions.
- Provide an entity-history view from entity detail screens (reservation, guest,
  employee, kubo, kubo type, additional charge, payment) for Administrators. Reuse the
  same timeline/drawer pattern as the global audit log.

Administrator only.

### 8.16 404

Centered `Result`-style page:

- 404 illustration.
- “Page not found.”
- “The page you are looking for does not exist or has been moved.”
- “Back to Dashboard” button.

---

## 9. Exact domain values

Use these values in tags, filters, and forms. Display friendly labels where useful, but
keep the underlying values consistent.

### Roles

- Administrator
- Staff

### Employee status

- Active
- Inactive
- Suspended
- OnLeave
- Terminated

### Reservation status

- Pending
- Confirmed
- CheckedIn
- CheckedOut
- Cancelled
- NoShow

### Reserved Kubo status

- Reserved
- CheckedIn
- CheckedOut
- Cancelled
- NoShow

### Kubo status

- Available
- Reserved
- Occupied
- Maintenance
- OutOfService
- Cleaning
- UnderInspection

### Payment status

- Pending
- Processing
- Completed
- Failed
- Cancelled
- Refunded
- PartiallyRefunded

`Refunded` and `PartiallyRefunded` are system-managed results of refunds.

### Transaction type

- Payment
- Refund
- Adjustment
- Reversal

`Adjustment` and `Reversal` are display-only values. User actions create only
`Payment` and `Refund` records.

### Payment type

- Deposit
- PartialPayment
- FullPayment
- BalancePayment
- AdditionalCharge

### Payment method

- Cash
- CreditCard
- DebitCard
- GCash
- Maya
- BankTransfer
- OnlineBanking
- Other

### Charge type

- ExtraBed
- ExtraPerson
- LateCheckOut
- EarlyCheckIn
- RoomService
- FoodAndBeverage
- Laundry
- CleaningFee
- Damage
- LostKey
- LostItem
- Transportation
- Minibar
- Other

### Charge request status

- Pending
- Approved
- Rejected
- Withdrawn

### Valid ID type

- Passport
- DriverLicense
- NationalID
- PhilHealthID
- SSSID
- UMID
- PostalID
- PRCID
- VotersID
- SeniorCitizenID
- StudentID
- Other

### Booking source

- WalkIn
- Online
- Phone
- Email
- Facebook
- TravelAgency
- Referral
- Other

### Audit action

- Create
- Update
- Delete
- Login
- Logout
- Cancel
- Approve
- Reject

---

## 10. Entity relationships to reflect in UI

- Role 1 → many Employees.
- Employee 1 → many Reservations.
- Guest 1 → many Reservations.
- Kubo Type 1 → many Kubos.
- Reservation 1 → many Reserved Kubos.
- Reservation has no header-level stay dates; each Reserved Kubo carries its own dates.
- Kubo 1 → many Reserved Kubos.
- Additional Charge Catalog 1 → many Applied Additional Charges.
- Reservation 1 → many Applied Additional Charges.
- Reservation 1 → many Additional Charge Requests.
- Additional Charge Request 0..1 → 1 Applied Additional Charge on approval.
- Reservation 1 → many Payments.
- Employee 1 → many Audit Logs as the acting employee.
- Audit Log uses `entity_type` + `entity_id` to reference affected records.

Important derived values:

```text
accommodation_total = Σ (nights × price_at_booking)
                      for non-cancelled assignments

charges_total       = accommodation_total + Σ additional_charge.amount
                      (display this as Grand Total)

net_paid            = Σ completed Payment amounts
                      − Σ completed Refund amounts

outstanding_balance = charges_total − net_paid
```

Do not store or hard-code totals in the UI model. Show them as derived summaries.

---

## 11. Business-rule guardrails for the prototype

### Guests

- Guest email is required and unique.
- Guest phone must be `09XXXXXXXXX` or `+639XXXXXXXXX`.
- Guest ID type + ID number must be unique.
- Guest addresses are optional.
- A guest can be reused when their email or ID details already exist.
- Guest name, contact, address, and ID details can be updated.
- Guests with reservations must not be deleted.
- Only Administrators may delete unused guests.

### Employees and roles

- Employees sign in with username, not email.
- Employee passwords are never displayed in tables, detail pages, or audit views.
- Passwords are 8–12 characters with uppercase, lowercase, number, and one of
  `@ $ ! % * ? &`.
- Only one Active Administrator is allowed.
- The last Active Administrator cannot be deactivated, reassigned, or deleted.
- Roles referenced by employees cannot be deleted.
- Employees with reservations, payments, charges, or audit history cannot be deleted.

### Kubos and kubo types

- Kubo types referenced by kubos cannot be deleted; there is no deactivate action.
- Kubos with assignment history cannot be deleted; set `OutOfService` instead.
- Kubo status changes must follow the allowed transition matrix.
- New kubos may start only as `Available`, `Maintenance`, or `OutOfService`.
- Kubo nightly-rate changes do not alter existing `price_at_booking` values.
- Editing assignment dates re-prices that assignment at the current nightly rate.
- Only one kubo assignment per kubo is valid for overlapping dates.

### Reservations and assignments

- A reservation has one guest, one creating employee, and one booking source.
- A reservation requires at least one kubo assignment.
- Each assignment has its own check-in and check-out dates; check-out must be later and
  check-in cannot be in the past.
- Assignment statuses are `Reserved`, `CheckedIn`, `CheckedOut`, `Cancelled`, and
  `NoShow`.
- Reservation status transitions:
  - `Pending` → `Confirmed`, `Cancelled`
  - `Confirmed` → `CheckedIn`, `Cancelled`, `NoShow`
  - `CheckedIn` → `CheckedOut`
  - `CheckedOut`, `Cancelled`, `NoShow` are terminal
- Only `Pending` reservations can be confirmed.
- Only `Pending` or `Confirmed` reservations can be modified or cancelled.
- Cancellation requires a reason and cancels all assignments.
- No-show requires `Confirmed` status and a scheduled check-in time that has passed.
- Assignments can be added, edited, or removed only while the reservation is `Pending`
  or `Confirmed` and the assignment is `Reserved`.
- At least one assignment must remain.
- Check-in is per kubo assignment, requires a `Confirmed` or `CheckedIn` reservation,
  a `Reserved` assignment, a ready kubo, and either the scheduled date or approved early
  check-in.
- Early check-in approval only sets a flag; it does not check the guest in.
- Check-out is per assignment, requires a `CheckedIn` reservation and assignment, and
  is blocked until the outstanding balance is exactly zero.
- Check-out sets the kubo to `Cleaning`; the reservation becomes `CheckedOut` when no
  active assignments remain.
- Reservation delete is a repair-only action and is blocked by any payment, additional
  charge, or custom charge-request history.

### Additional charges

- Additional charges use a catalog unit price and applied quantity; the applied amount is
  quantity × unit amount.
- Only active catalog items can be applied.
- Catalog items used by any applied charge cannot be deleted; deactivate them.
- Applied catalog charges copy the catalog name, not the catalog description.
- Applied charges are append-only after settlement.
- Staff may delete applied charges only before settlement.
- Settlement means `CheckedOut`, `Cancelled`, or `NoShow`, or any completed
  payment/refund.
- Administrators do not edit or delete applied charges.
- Administrators manage the catalog and approve/reject/adjust custom requests.
- Administrator corrections are additive: a new charge with a reason. The original is
  never edited or deleted.
- There is no implemented reduction flow; do not show Adjustment or Reversal actions.
- Pending, rejected, and withdrawn custom requests do not affect the balance.
- Approval creates the applied charge; rejection or withdrawal creates no charge.
- Only the requesting Staff member may withdraw a `Pending` request.

### Payments and refunds

- New payments start as `Pending`.
- Manual payment transitions:
  - `Pending` → `Processing`, `Completed`, `Failed`, `Cancelled`
  - `Processing` → `Completed`, `Failed`, `Cancelled`
  - All other outgoing transitions are blocked.
- Completing a payment re-checks the outstanding balance and can fail if the amount no
  longer fits.
- Refunds require a `Completed` or `PartiallyRefunded` original payment from the same
  reservation.
- Refund amounts are positive and cannot exceed the net amount paid.
- The original payment becomes `PartiallyRefunded` or `Refunded` based on the cumulative
  refund total.
- Do not offer Adjustment or Reversal creation.
- Administrator payment cleanup deletion is a repair-only action and does not repair the
  ledger.

### Audit and display

- Audit logs are append-only and read-only in the UI.
- Audit access is Administrator-only.
- Do not expose internal database IDs as the primary user-facing identifier where a
  reference code or human-readable label exists.
- Label `charges_total` as **Grand Total**, not “charges”.

---

## 12. Mock data guidance

Use realistic Philippine resort data.

Example kubo types:

- Garden Kubo — capacity 2 — ₱2,500/night
- Family Kubo — capacity 4 — ₱4,200/night
- Beachfront Kubo — capacity 2 — ₱3,800/night

Example kubos:

- K-01, K-02, K-03, K-04, K-05
- Mix of Available, Reserved, Occupied, Cleaning, Maintenance.

Example guests:

- Maria Santos — `maria.santos@example.com` — `09171234567` — NationalID
- John Reyes — `john.reyes@example.com` — `+639181234567` — DriverLicense
- Angela Cruz — `angela.cruz@example.com` — `09991234567` — Passport

Example reservations:

- `RES-20261110-0001` — Pending — Maria Santos — K-01 — 2026-11-10 to 2026-11-12
- `RES-20261110-0002` — Confirmed — John Reyes — K-03 — 2026-11-12 to 2026-11-15
- `RES-20261110-0003` — CheckedIn — Angela Cruz — K-02 — 2026-11-09 to 2026-11-10
- `RES-20261110-0004` — CheckedOut — Maria Santos — K-04 — 2026-11-01 to 2026-11-03
- `RES-20261110-0005` — Cancelled — John Reyes — K-05 — 2026-11-20 to 2026-11-22
- `RES-20261110-0006` — Confirmed — Angela Cruz — K-01 and K-02 —
  2026-11-18 to 2026-11-20

Example assignment detail:

- `RES-20261110-0006` — K-01 — Reserved — 2026-11-18 to 2026-11-20 — ₱2,500/night
- `RES-20261110-0006` — K-02 — Reserved — 2026-11-19 to 2026-11-21 — ₱3,800/night

Example charge catalog:

- Extra Pillow — ExtraBed — ₱100 — Active
- Extra Bed — ExtraBed — ₱500 — Active
- Late Check-Out — LateCheckOut — ₱800 — Active
- Room Service — RoomService — ₱350 — Active
- Minibar — Minibar — ₱250 — Inactive

Example applied charges:

- Extra Pillow — quantity 2 — ₱100 each — ₱200 — before settlement
- LateCheckOut — quantity 1 — ₱800 — “LateCheckOut” — after settlement
- RoomService — quantity 1 — ₱350 — “RoomService” — correction added by Admin

Example custom requests:

- `Other` — “Special anniversary decoration” — quantity 1 — proposed ₱500 — Pending
- `Other` — “Airport transfer” — quantity 1 — proposed ₱1,800 — Approved —
  applied charge ₱1,800
- `Other` — “Private dinner setup” — quantity 1 — proposed ₱2,000 — Rejected
- `Other` — “Extra towel service” — quantity 2 — proposed ₱150 — Withdrawn

Example payments:

- Deposit — GCash — ₱2,000 — Completed — original is `PartiallyRefunded`
- BalancePayment — Cash — ₱3,500 — Pending
- Refund — GCash — ₱1,000 — Completed — linked to the deposit

Keep mock data internally consistent across list, detail, dashboard, and audit screens.

---

## 13. Deliverables

Generate:

1. Desktop layouts at 1440px width.
2. Responsive tablet and mobile variants for key screens.
3. Separate Staff and Administrator navigation variants.
4. Reusable component library / design-system frame.
5. List, detail, create, and edit screens.
6. Form validation states and inline error messages.
7. Loading, empty, error, and success states.
8. Modals/drawers for:
   - New/edit guest.
   - Add, edit, and remove kubo assignment.
   - Approve early check-in.
   - Check-in and check-out per kubo.
   - Add payment.
   - Update payment status.
   - Record refund.
   - Apply catalog charge.
   - Request custom charge.
   - Withdraw custom charge request.
   - Review custom charge request.
   - Record applied-charge correction.
   - Delete applied charge before settlement.
   - Payment cleanup delete.
   - Confirm reservation cancellation.
   - Reset employee password.
   - Delete confirmation.
   - Entity history.
9. Status tag variants for every enum group.
10. A prototype flow connecting:
    - Login → Dashboard → Guests → Reservation with assignments → Payment →
      per-kubo check-in → per-kubo check-out.
    - Staff → Reservation Detail → Add/Edit/Remove Assignment.
    - Staff → Reservation Detail → Approve Early Check-In → Check In.
    - Staff → Reservation Detail → Apply Catalog Charge.
    - Staff → Reservation Detail → Delete Applied Charge before settlement.
    - Staff → Reservation Detail → Request Custom Charge → Pending → Withdraw.
    - Staff → Reservation Detail → Record Payment → Update Status.
    - Staff → Reservation Detail → Record Refund.
    - Admin → Charge Catalog → Create/Edit/Deactivate.
    - Admin → Charge Requests → Approve/Reject/Adjust.
    - Admin → Applied Charges → Additive Correction.
    - Admin → Payments → Review → Cleanup Delete (repair only).
    - Admin → Employees → Roles.
    - Admin → Audit Logs → Entity History.

---

## 14. Do not invent

Do **not** add:

- Endpoint paths, HTTP methods, request/response payloads, status-code tables, or API
  contracts. This brief is UI-only.
- Room or Room Type terminology.
- Employee email, phone, address, shift, or attendance fields.
- Guest loyalty points, membership tiers, or marketing fields.
- Amenities, floor, bed count, or view fields for kubos.
- Party-size or guest-count fields on reservations.
- Reservation-level check-in/check-out. Check-in and check-out are per kubo assignment.
- A generic service catalog beyond the managed additional-charge catalog.
- Taxes, discounts, vouchers, or seasonal rates.
- Stored report tables.
- Approval/void status on applied additional charges; approval status belongs to the
  separate charge-request record.
- Edit or delete actions for settled applied charges.
- Administrator deletion of applied charges; Staff delete before settlement only.
- Administrator overriding applied-charge prices; catalog prices are snapshotted.
- Adjustment or Reversal creation actions.
- A charge-reduction flow. Administrator corrections are additive only.
- Payment forms that let the user choose the transaction type.
- A role selector on login.
- Receptionist, Manager, Housekeeping, or System Admin roles.
- Reports or analytics pages that are not represented in the documented flows.

---

## 15. Source references

This brief is based on the domain and UI planning documents:

- `docs/business_rules.md`
- `docs/system_flowcharts.md`
- `docs/database.md`
- `docs/architecture.md`
- `docs/validation.md`
- `frontend/docs/frontend-ui-specification.md`
- `frontend/docs/frontend-component-guide.md`
- `frontend/docs/frontend-architecture.md`

This brief intentionally contains no API contract details. Do not add endpoint lists,
request/response schemas, or implementation notes.

Where those documents conflict, follow the canonical domain terminology and business
rules in this brief, especially:

- Kubo / Kubo Type instead of Room / Room Type.
- Administrator / Staff only.
- Username-based employee sign-in.
- Per-assignment stay dates and per-kubo check-in/check-out.
- Catalog-based applied charges and approval-gated custom requests.
- Additive applied-charge corrections with no reduction flow.
- Derived financial totals, with `charges_total` shown as Grand Total.
