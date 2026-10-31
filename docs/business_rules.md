# Kubo Reservation and Booking System — Business Rules

| | |
|---|---|
| **Status** | Revised specification |
| **Source of truth for schema** | `docs/business_rules_DDL.md` (latest DDL in that file) |
| **Supporting references** | `docs/ERD&Flowcharts.drawio`, previous rules `a–m` in `docs/business_rules_DDL.md` |
| **Last revised** | 2026-10-24 |
| **Scope** | Simple reservation and booking system for a small resort |

> The latest DDL is authoritative. Where the ERD or the previous rules use names or
> fields that no longer exist in the DDL, the DDL wins and the difference is recorded
> in `docs/business_rules_review.md`.

---

## 1. Purpose and Scope

The system supports the daily reservation operations of a small resort. It allows
staff to register guests, create and manage reservations, assign kubos (accommodation
units) for a date range, record payments and additional charges, and process
check-in and check-out. Administrators manage employees and roles, configure kubo
types, kubos, and rates, review reservations and the audit trail, and manage
additional-charge corrections. Administrators do **not** perform staff operations.

The system covers:

- Role-based authentication and authorization for **Administrator** and **Staff**,
  with a deliberate separation of duties (BR-005).
- Employee and role administration.
- Guest registration and retrieval.
- Kubo type, kubo, and rate configuration.
- Reservation creation, modification, confirmation, cancellation, and no-show handling.
- Date-range kubo availability and assignment.
- Accommodation pricing at the time of booking.
- Additional charges.
- Payments, partial payments, and refunds.
- Check-in and check-out.
- Audit logging of significant operations.

The system does **not** include, because the schema has no supporting tables or
columns: shift scheduling, attendance tracking, a service catalog, seasonal or
date-based rates, tax rules, discounts, party-size storage, or persisted report tables.
These limitations are detailed in Section 14.

---

## 2. Terminology

| Term | Meaning | Primary table(s) |
|---|---|---|
| **Employee** | System user who signs in. Every employee has exactly one role. | `employee`, `role` |
| **Administrator** | Administrative role. Manages employees and roles, kubo types, kubos, rates, reservation review, audit review, and additional-charge corrections. Does **not** perform staff operations. Called *Owner* in the old rules. | `role`, `employee` |
| **Staff** | Operational role. Handles guests, reservations, operational additional charges, payments and refunds, and check-in/out. | `role`, `employee` |
| **Guest** | Person for whom a reservation is made. Called *Customer* in the old rules. | `guest` |
| **Kubo type** | Accommodation category with capacity and nightly price. Called *room type* in the ERD and old rules. | `kubo_type` |
| **Kubo** | A rentable accommodation unit. Called *room* in the ERD and old rules. | `kubo` |
| **Reservation** | Booking header for one guest, encoded by one employee. | `reservation` |
| **Reserved kubo** | One kubo assigned to a reservation for a date range. A reservation has one or more of these. | `reserved_kubo` |
| **Additional charge** | Extra amount billed to a reservation (extra bed, damage, late check-out, etc.). | `additional_charge` |
| **Payment** | Money transaction applied to a reservation (payment, refund, adjustment, reversal). | `payment` |
| **Audit log** | Append-only record of significant actions performed by employees. | `audit_log` |

> **Terminology note:** This document uses the DDL names **kubo** and **kubo type**.
> The ERD, old rules, and some backend modules still say *room* and *room type*. They
> refer to the same concepts. New documentation and UI text should use kubo terminology.

---

## 3. User Roles, Accounts, and Permissions

### 3.1 Roles

The `role` table stores role names. The DDL makes `role_name` unique but does not
restrict the values. The business defines two operational roles:

| `role_name` | Purpose |
|---|---|
| **Administrator** | Administration and oversight: employees and roles, kubo types and kubos, rates, read-only reservation review, audit-log review, and additional-charge corrections. |
| **Staff** | Daily operational transactions: guests, reservations, kubos assignments, charges, payments, and check-in/check-out. |

### 3.2 Permission matrix

| Capability | Administrator | Staff |
|---|:---:|:---:|
| Sign in and access the system | Yes, while `Active` | Yes, while `Active` |
| View reservations, assignments, charges, payments, and balances (read-only) | Yes | Yes |
| Register or update guests | No | Yes |
| Create, modify, or cancel reservations | No (view-only) | Yes |
| Check availability and assign kubos | No | Yes |
| Record operational additional charges | No | Yes |
| Record payments and refunds | No | Yes |
| Check in and check out guests | No | Yes |
| Manage employees and roles | Yes | No |
| Manage kubo types, kubos, and rates | Yes | No |
| Review and correct additional charges | Yes, as audited corrections (BR-081) | No |
| Approve audited corrections and settlement exceptions | Yes | No |
| View the audit log | Yes | No |

**Separation of duties:** The Administrator does **not** inherit Staff capabilities.
The roles are deliberately disjoint: Staff perform operational transactions, and
Administrators perform configuration, oversight, and audited corrections (BR-005).
The DDL has no permission table, so this matrix is enforced by the application.

### 3.3 Rules

#### BR-001 — Each employee has exactly one role
- **Rule:** Every employee record must reference exactly one existing `role` through
  `employee.role_id`. An employee cannot hold two roles simultaneously. The two
  operational role names are `Administrator` and `Staff`.
- **Entities:** `employee`, `role`
- **Enforcement:** `employee.role_id` is `NOT NULL` and a foreign key with
  `ON DELETE RESTRICT`; `role.role_name` is unique. The set of role names is a
  business policy, not a database constraint.

#### BR-002 — Required employee account data
- **Rule:** An employee account must have `first_name`, `last_name`, a unique
  `username`, `password_hash`, and `role_id`. `status` defaults to `Active` and
  `created_at` defaults to the current timestamp. The schema has no middle-initial,
  date-hired, emergency-contact, or shift-schedule fields.
- **Entities:** `employee`
- **Enforcement:** `NOT NULL` and `UNIQUE (username)` constraints in the DDL.

#### BR-003 — Credential rules
- **Rule:** A username must be unique and is used to sign in. A password must be 6–12
  alphanumeric characters (retained from the old rule) and must be stored only as a
  salted hash in `password_hash`. Plaintext passwords and hashes must never be returned
  by the API or written to logs/audit descriptions.
- **Entities:** `employee`
- **Enforcement:** Uniqueness is enforced by the DDL; password format and hashing are
  application-level validation. The DDL does not store password history or reset
  tokens.

#### BR-004 — Employee status controls access
- **Rule:** Only an employee with `status = 'Active'` may sign in or perform an
  operation. `Inactive`, `Suspended`, `OnLeave`, and `Terminated` employees are denied.
  Status changes are Administrator-only and must be audited.
- **Entities:** `employee`
- **Enforcement:** Application/middleware check. The `employee_status` enum constrains
  the allowed values but cannot itself block a session.

#### BR-005 — Role-based authorization and separation of duties
- **Rule:** Every protected operation checks the employee's role before executing.
  The roles are disjoint:
  - **Staff** perform operational transactions: guest registration, reservation
    creation and management, availability checks and kubo assignment, operational
    additional-charge entry, payments and refunds, and check-in/check-out.
  - **Administrators** perform administrative functions: employee and role
    management, kubo type/kubo/rate configuration, read-only reservation review,
    audit-log review, and additional-charge management (review and audited
    corrections).

  An Administrator must not perform Staff operations, and Staff must not perform
  Administrator operations. Administrative approvals required by BR-053, BR-057, and
  BR-064 are authorizations recorded in the audit log; they do not authorize an
  Administrator to execute the underlying operational transaction.
- **Entities:** `employee`, `role`, `audit_log`
- **Enforcement:** Application middleware/service layer. The DDL has no permission
  table, so the matrix is enforced in code.

#### BR-006 — At most one active Administrator (operational policy)
- **Rule:** At most one `Administrator` account may have `status = 'Active'` at a time.
  This retains the old "only one Owner" rule. If the project owner wants multiple
  administrators, this rule must be explicitly relaxed.
- **Entities:** `employee`, `role`
- **Enforcement:** Application-level check when creating or activating an
  administrator. **Not enforced by the DDL**, which permits any number of employees
  with the same role.

#### BR-007 — Employees are retained, not deleted
- **Rule:** Employees with historical records must not be hard-deleted. Employment
  ends by setting `status = 'Terminated'` (or `Inactive`). Historical reservations,
  payments, charges, and audit entries remain linked to the employee.
- **Entities:** `employee`, `reservation`, `payment`, `additional_charge`, `audit_log`
- **Enforcement:** Foreign keys use `ON DELETE RESTRICT`, so the database blocks
  deletion while references exist. The preferred operational action is a status change.

#### BR-008 — Role management is Administrator-only
- **Rule:** Only an Administrator may create, rename, or delete roles. A role may be
  deleted only when no employee references it. Renaming a role changes the name shown
  for all assigned employees.
- **Entities:** `role`, `employee`
- **Enforcement:** `UNIQUE (role_name)` and `ON DELETE RESTRICT`; authorization is
  application-level.

---

## 4. Guest Information

#### BR-009 — Required guest details
- **Rule:** A guest must have `first_name`, `last_name`, `email`, `phone`,
  `valid_id_type`, and `id_number`. Address fields are optional. `created_at` and
  `updated_at` default to the current timestamp.
- **Entities:** `guest`
- **Enforcement:** `NOT NULL` constraints in the DDL.

#### BR-010 — Email is required and unique
- **Rule:** Every guest must have a syntactically valid email address, and no two
  guest records may share the same email. The email is the primary duplicate-check
  value when retrieving an existing guest.
- **Entities:** `guest`
- **Enforcement:** `NOT NULL` and `UNIQUE (email)` in the DDL; format validation is
  application-level.

#### BR-011 — Valid ID type and ID number
- **Rule:** `valid_id_type` must be one of: `Passport`, `DriverLicense`, `NationalID`,
  `PhilHealthID`, `SSSID`, `UMID`, `PostalID`, `PRCID`, `VotersID`,
  `SeniorCitizenID`, `StudentID`, or `Other`. `id_number` is required. The pair
  (`valid_id_type`, `id_number`) must not be duplicated across guests.
- **Entities:** `guest`
- **Enforcement:** Enum and `NOT NULL` constraints in the DDL. The DDL has **no unique
  constraint** on (`valid_id_type`, `id_number`), so uniqueness must be checked by the
  application (see gap G-03).

#### BR-012 — Guest phone number
- **Rule:** `phone` is required and must be a valid Philippine contact number,
  retained from the old requirement. The DDL stores it as `VARCHAR(20)`.
- **Entities:** `guest`
- **Enforcement:** Application-level format validation; the DDL only enforces
  `NOT NULL` and the column length.

#### BR-013 — Guest reuse and duplicate prevention
- **Rule:** Before creating a guest, staff must search by email (and optionally by ID
  details). If the guest already exists, the existing `guest_id` must be reused for
  the reservation instead of creating a duplicate.
- **Entities:** `guest`, `reservation`
- **Enforcement:** Application-level duplicate check; email uniqueness provides a
  final database safeguard.

#### BR-014 — Guest updates do not rewrite history
- **Rule:** Guest contact and address details may be updated by Staff or an
  Administrator. Updates must be audited. A reservation continues to reference the
  same `guest_id`; the system does not keep a per-reservation snapshot of guest
  details.
- **Entities:** `guest`, `reservation`, `audit_log`
- **Enforcement:** Application-level update plus audit write.

#### BR-015 — Guests with reservations are not deleted
- **Rule:** A guest with one or more reservations must not be hard-deleted. The record
  is retained for historical integrity.
- **Entities:** `guest`, `reservation`
- **Enforcement:** `reservation.guest_id` uses `ON DELETE RESTRICT`. See gap G-04 for
  guests without reservations.

---

## 5. Kubo Types, Kubos, and Rates

#### BR-016 — Kubo type validation
- **Rule:** A kubo type must have a unique `type_name`, a `capacity` greater than zero,
  and a `price_per_night` greater than or equal to zero. `description` is optional.
- **Entities:** `kubo_type`
- **Enforcement:** `UNIQUE (type_name)`, `CHECK (capacity > 0)`, and
  `CHECK (price_per_night >= 0)` in the DDL.

#### BR-017 — Kubo validation
- **Rule:** A kubo must have a unique `kubo_number` and reference an existing
  `kubo_type_id`. `status` defaults to `Available`. A kubo cannot exist without a type.
- **Entities:** `kubo`, `kubo_type`
- **Enforcement:** `UNIQUE (kubo_number)`, `NOT NULL`, and
  `ON DELETE RESTRICT` for the type foreign key.

#### BR-018 — Configuration is Administrator-only
- **Rule:** Only an Administrator may create or change kubo types, kubos, and rates.
  Staff may read this configuration when handling reservations but may not modify it.
- **Entities:** `kubo_type`, `kubo`
- **Enforcement:** Application/authorization layer.

#### BR-019 — `price_per_night` is the only rate
- **Rule:** The nightly rate for a kubo is the `price_per_night` of its `kubo_type`.
  The schema has no separate rate table, no date ranges, no seasonal rates, no
  discounts, and no taxes. All kubos of the same type share the type rate.
- **Entities:** `kubo_type`, `kubo`
- **Enforcement:** Schema limitation; the application must not invent another rate
  source.

#### BR-020 — Rate changes apply to new bookings only
- **Rule:** Changing `kubo_type.price_per_night` affects only reservations created
  afterwards. Each `reserved_kubo.price_at_booking` is a snapshot taken at booking time
  and must not be changed when the type rate changes. An explicit, audited correction
  is required to change an existing `price_at_booking`.
- **Entities:** `kubo_type`, `reserved_kubo`
- **Enforcement:** Application logic. The DDL stores both values independently, so
  nothing prevents accidentally updating history; the rule must be enforced in the
  service/procedure.

#### BR-021 — Kubo status transitions
- **Rule:** `kubo.status` uses the `kubo_status` enum and follows these operational
  transitions:

  | From | Allowed to |
  |---|---|
  | `Available` | `Reserved`, `Occupied`, `Cleaning`, `Maintenance`, `UnderInspection`, `OutOfService` |
  | `Reserved` | `Occupied`, `Available`, `Maintenance`, `UnderInspection`, `OutOfService` |
  | `Occupied` | `Cleaning`, `Maintenance`, `UnderInspection`, `OutOfService` |
  | `Cleaning` | `Available`, `Maintenance`, `UnderInspection`, `OutOfService` |
  | `Maintenance` | `Available` |
  | `UnderInspection` | `Available` |
  | `OutOfService` | `Available` |

  Status changes occur in two ways:
  - as a consequence of Staff check-in/check-out operations (`→ Occupied`,
    `→ Cleaning`, and `→ Available` when ready) under BR-060 and BR-063; and
  - as administrative changes performed by an Administrator through kubo management
    (for example `→ Maintenance`, `→ UnderInspection`, `→ OutOfService`, or
    returning those states to `Available`).

  Every status change must be audited.
- **Entities:** `kubo`, `audit_log`
- **Enforcement:** Application-level transition validation. The enum constrains the
  value set but does not constrain transitions.

#### BR-022 — Kubo types cannot be deactivated
- **Rule:** The schema has no `is_active` flag for kubo types. A kubo type must not be
  hard-deleted while any kubo references it. To stop selling a type, mark all of its
  kubos `OutOfService`; do not delete the type. The old requirement to "deactivate a
  room type" is therefore **not supported as a type-level operation**.
- **Entities:** `kubo_type`, `kubo`
- **Enforcement:** `kubo.kubo_type_id` uses `ON DELETE RESTRICT`. See gap G-02.

#### BR-023 — Kubos with history are not deleted
- **Rule:** A kubo referenced by `reserved_kubo` must not be hard-deleted. Take it out
  of service with `status = 'OutOfService'` instead. Renaming `kubo_number` is allowed
  if the new number remains unique and the change is audited.
- **Entities:** `kubo`, `reserved_kubo`
- **Enforcement:** `reserved_kubo.kubo_id` uses `ON DELETE RESTRICT`;
  `UNIQUE (kubo_number)`. See gap G-04.

---

## 6. Reservations and Booking Validation

### 6.1 Reservation status transitions

| From | Allowed to |
|---|---|
| `Pending` | `Confirmed`, `Cancelled` |
| `Confirmed` | `CheckedIn`, `Cancelled`, `NoShow` |
| `CheckedIn` | `CheckedOut` |
| `CheckedOut` | — (terminal) |
| `Cancelled` | — (terminal) |
| `NoShow` | — (terminal) |

A cancelled reservation cannot be re-confirmed. A new reservation must be created
instead (retained from old rule `l`).

### 6.2 Rules

#### BR-024 — Required reservation data
- **Rule:** A reservation must have a unique `reference_code`, a `guest_id`, an
  `employee_id`, a `booking_source`, and `status` (default `Pending`).
  `reserved_at` defaults to the current timestamp. `cancelled_at` and
  `cancellation_reason` remain `NULL` until cancellation.
- **Entities:** `reservation`
- **Enforcement:** `NOT NULL` and `UNIQUE (reference_code)` in the DDL.

#### BR-025 — Reference code
- **Rule:** The system generates the `reference_code` when the reservation is created.
  It must be unique and is immutable thereafter. The format is implementation-defined;
  the DDL only defines `VARCHAR(50)` and uniqueness.
- **Entities:** `reservation`
- **Enforcement:** `UNIQUE (reference_code)`; generation and immutability are
  application-level.

#### BR-026 — Booking source
- **Rule:** `booking_source` is mandatory and must be one of: `WalkIn`, `Online`,
  `Phone`, `Email`, `Facebook`, `TravelAgency`, `Referral`, or `Other`.
- **Entities:** `reservation`
- **Enforcement:** `NOT NULL` and the `booking_source` enum in the DDL.

#### BR-027 — Exactly one guest and one creating employee
- **Rule:** Every reservation belongs to exactly one guest and records exactly one
  employee who encoded it. The encoded employee is historical: later changes to that
  employee's status or role do not alter the reservation.
- **Entities:** `reservation`, `guest`, `employee`
- **Enforcement:** `NOT NULL` foreign keys with `ON DELETE RESTRICT`.

#### BR-028 — At least one reserved kubo
- **Rule:** A reservation must contain at least one `reserved_kubo` assignment. A
  reservation with no assigned kubo is invalid. A reservation may contain multiple
  kubos.
- **Entities:** `reservation`, `reserved_kubo`
- **Enforcement:** **Not enforceable by the DDL** (a header row can exist with zero
  child rows). The create/update procedure must enforce it inside a transaction.
  See gap G-05.

#### BR-029 — Booking date validation
- **Rule:** Every assignment must have `check_in_date` and `check_out_date`, and
  `check_out_date` must be later than `check_in_date`. A new booking must not start in
  the past. If `scheduled_check_in_time` and `scheduled_check_out_time` are supplied,
  the scheduled check-out time must be later than the scheduled check-in time.
- **Entities:** `reserved_kubo`
- **Enforcement:** `CHECK (check_out_date > check_in_date)` in the DDL. "Not in the
  past" and the scheduled-time ordering are application-level.

#### BR-030 — Required assignment data and price snapshot
- **Rule:** Each assignment must identify the reservation, the kubo, the date range,
  `price_at_booking` (greater than or equal to zero), and a `reserved_kubo.status`
  (default `Reserved`). The scheduled and actual timestamps are optional at creation.
  `price_at_booking` records the nightly rate in effect when the kubo was assigned.
- **Entities:** `reserved_kubo`
- **Enforcement:** Composite primary key, `NOT NULL`, and
  `CHECK (price_at_booking >= 0)` in the DDL. The nightly-rate interpretation is an
  assumption (see A-02).

#### BR-031 — No overlapping assignments for the same kubo
- **Rule:** For a given kubo, two assignments conflict when their date ranges overlap
  (`existing.check_in_date < new.check_out_date` **and**
  `existing.check_out_date > new.check_in_date`) and the existing assignment has
  status `Reserved` or `CheckedIn`. A conflicting assignment must be rejected.
  Assignments with status `Cancelled`, `NoShow`, or `CheckedOut` do not block new
  bookings.
- **Entities:** `reserved_kubo`
- **Enforcement:** **Not enforceable by the DDL** — there is no exclusion constraint or
  unique constraint on kubo/date ranges. The availability check and insert must run in
  one transaction (BR-032). See gap G-01.

#### BR-032 — Availability checks must be atomic
- **Rule:** The overlap check and the reservation/assignment insert (or update) must
  execute in a single database transaction. The affected kubo rows must be locked, or
  the transaction must run at a isolation level that prevents two concurrent bookings
  from both passing the same availability check.
- **Entities:** `reservation`, `reserved_kubo`, `kubo`
- **Enforcement:** PostgreSQL function/procedure with a transaction and row locking
  (`SELECT ... FOR UPDATE` on the kubo or an equivalent serialized check). The DDL
  alone cannot prevent the race.

#### BR-033 — Reservation status transitions
- **Rule:** Only the transitions in the table in Section 6.1 are allowed. The status
  must never be set directly to an arbitrary value, and terminal states
  (`CheckedOut`, `Cancelled`, `NoShow`) cannot be reopened.
- **Entities:** `reservation`
- **Enforcement:** Application-level state machine. The enum constrains the value set
  but does not constrain transitions.

#### BR-034 — Confirmation
- **Rule:** A newly created reservation starts as `Pending`. It becomes `Confirmed`
  only after the guest, dates, kubo availability, and price are validated. Confirmation
  does not require a deposit unless the project owner defines such a policy; the schema
  supports an optional payment at booking. The transition must be audited.
- **Entities:** `reservation`, `reserved_kubo`, `payment`, `audit_log`
- **Enforcement:** Application-level; the DDL defaults `status` to `Pending`.

#### BR-035 — Cancellation
- **Rule:** A reservation may be cancelled only from `Pending` or `Confirmed`. A
  cancellation must:
  1. set `status = 'Cancelled'`;
  2. set `cancelled_at` to the cancellation timestamp;
  3. set `cancellation_reason` to a non-empty reason;
  4. set every child `reserved_kubo.status` to `Cancelled`;
  5. release any `kubo.status` held for the cancelled stay; and
  6. be audited.

  A reservation that is already `CheckedIn`, `CheckedOut`, `Cancelled`, or `NoShow`
  cannot be cancelled. There is no separate cancellation table. Payments already
  received are not automatically refunded; refunds follow BR-054.
- **Entities:** `reservation`, `reserved_kubo`, `kubo`, `payment`, `audit_log`
- **Enforcement:** Application-level state transition and transactional update. The DDL
  stores the cancellation fields but does not require them to be populated together.

#### BR-036 — No-show
- **Rule:** A reservation may be marked `NoShow` only from `Confirmed`, after the
  scheduled check-in date/time has passed without check-in. All child assignments
  become `NoShow`. A no-show reservation cannot be checked in later; a new reservation
  is required. No-show handling does not automatically refund payments; refunds follow
  BR-054.
- **Entities:** `reservation`, `reserved_kubo`, `payment`, `audit_log`
- **Enforcement:** Application-level state transition.

#### BR-037 — Modifying a reservation
- **Rule:** Reservation details (guest, booking source, dates, and assigned kubos) may
  be changed only while the reservation is `Pending` or `Confirmed` and before any
  check-in. Every change must:
  1. re-validate the date rules and availability (excluding the reservation's own
     assignments);
  2. re-snapshot `price_at_booking` for newly added or re-dated assignments from the
     current `kubo_type.price_per_night`;
  3. preserve the price of unchanged assignments unless an explicit audited correction
     is made; and
  4. be audited.

  Status changes must use the dedicated transition operations, not a generic update.
- **Entities:** `reservation`, `reserved_kubo`, `kubo_type`, `audit_log`
- **Enforcement:** Application-level, in one transaction.

#### BR-038 — Reservations are cancelled, not deleted
- **Rule:** Normal operations must not delete reservations. Use `Cancelled` to release
  the booking. Hard deletion is an administrative repair action only, must be audited,
  and is blocked by the database when payments or additional charges exist.
- **Entities:** `reservation`, `reserved_kubo`, `payment`, `additional_charge`,
  `audit_log`
- **Enforcement:** `reserved_kubo` cascades on reservation deletion, but `payment` and
  `additional_charge` use `ON DELETE RESTRICT`, so a reservation with financial history
  cannot be deleted. Application policy forbids routine deletion.

---

## 7. Pricing and Additional Charges

#### BR-039 — Accommodation price calculation
- **Rule:** The accommodation amount for one assignment is:

  `nights = check_out_date - check_in_date`

  `accommodation_amount = nights × price_at_booking`

  `price_at_booking` is copied from `kubo_type.price_per_night` when the assignment is
  created or re-dated. A reservation's accommodation total is the sum over its
  non-cancelled assignments.
- **Entities:** `kubo_type`, `reserved_kubo`
- **Enforcement:** Application-level calculation. The DDL stores the nightly snapshot
  and the dates but has no total column.

#### BR-040 — No stored reservation total
- **Rule:** The DDL has no `total_reservation_amount` column. The reservation total,
  charges total, net paid, and outstanding balance are **derived** by aggregation and
  must not be treated as stored columns. The ERD and some backend code still show a
  total field; that field is stale (see gap G-06).
- **Entities:** `reserved_kubo`, `additional_charge`, `payment`
- **Enforcement:** Schema limitation; calculations happen in the service/reporting
  layer.

#### BR-041 — No discounts, taxes, or seasonal pricing
- **Rule:** The schema supports only a single `price_per_night` per kubo type. No
  discount, tax, seasonal, promotional, or length-of-stay rate may be applied unless
  the schema is extended. Additional amounts are recorded only through
  `additional_charge`.
- **Entities:** `kubo_type`, `additional_charge`
- **Enforcement:** Schema limitation; application must not invent unsupported pricing
  components.

#### BR-042 — Required additional-charge data
- **Rule:** An additional charge must have a `reservation_id`, an `employee_id`, a
  `charge_type`, and an `amount` greater than or equal to zero. `description` is
  optional. `charge_date` defaults to the current timestamp.
- **Entities:** `additional_charge`
- **Enforcement:** `NOT NULL` and `CHECK (amount >= 0)` in the DDL.

#### BR-043 — When charges may be recorded
- **Rule:** Additional charges may be recorded for a reservation that is `Pending`,
  `Confirmed`, `CheckedIn`, or `CheckedOut` while the account is still being settled.
  Charges must not be added to a `Cancelled` or `NoShow` reservation except to correct
  an amount already owed before cancellation/no-show, and such a case must be audited.
  Operational charge entry is a Staff operation (BR-005). Administrators handle
  disputed or incorrect charges through the administrative correction path in BR-081.
- **Entities:** `additional_charge`, `reservation`
- **Enforcement:** Application-level status check.

#### BR-044 — Charge types
- **Rule:** `charge_type` must be one of: `ExtraBed`, `ExtraPerson`, `LateCheckOut`,
  `EarlyCheckIn`, `RoomService`, `FoodAndBeverage`, `Laundry`, `CleaningFee`,
  `Damage`, `LostKey`, `LostItem`, `Transportation`, `Minibar`, or `Other`.
  There is no service catalog or service table; `description` carries any detail.
- **Entities:** `additional_charge`
- **Enforcement:** `charge_type` enum; `description` is free text.

#### BR-045 — Charges do not alter the booked rate
- **Rule:** Adding an additional charge must not modify `reserved_kubo.price_at_booking`
  or the kubo type rate. Charges are separate bill items.
- **Entities:** `additional_charge`, `reserved_kubo`
- **Enforcement:** Application-level separation of concerns.

#### BR-046 — Charges are append-only after settlement
- **Rule:** Once a charge has been included in a completed payment or the reservation is
  checked out, it must not be silently edited or deleted. Corrections must be recorded
  as a new, audited charge/payment adjustment. The DDL has no charge status or void
  flag, so this is an operational control.
- **Entities:** `additional_charge`, `payment`, `audit_log`
- **Enforcement:** Application policy and audit trail.

#### BR-047 — Derived billing amounts
- **Rule:** The following definitions apply:

  ```
  accommodation_total = Σ (nights × price_at_booking)
                        for non-cancelled assignments

  charges_total       = accommodation_total + Σ additional_charge.amount

  net_paid            = Σ payment_amount where transaction_type = 'Payment'
                        and payment_status = 'Completed'
                      − Σ payment_amount where transaction_type = 'Refund'
                        and payment_status = 'Completed'

  outstanding_balance = charges_total − net_paid
  ```

  `Adjustment` and `Reversal` transactions do not alter `net_paid` until their
  semantics are confirmed (see gap G-07).
- **Entities:** `reserved_kubo`, `additional_charge`, `payment`
- **Enforcement:** Application/reporting-level aggregation. No stored totals.

#### BR-048 — Currency and precision
- **Rule:** Monetary amounts are in Philippine pesos (PHP), with at most two decimal
  places. All amounts must be non-negative in storage; a refund is represented by its
  `transaction_type`, not by a negative amount.
- **Entities:** `kubo_type`, `reserved_kubo`, `payment`, `additional_charge`
- **Enforcement:** `DECIMAL(10,2)` columns and `CHECK (>= 0)` constraints. The currency
  is not stored in the schema; PHP is an assumption (A-03).

---

## 8. Payments and Refunds

### 8.1 Payment status transitions

| From | Allowed to |
|---|---|
| `Pending` | `Processing`, `Completed`, `Failed`, `Cancelled` |
| `Processing` | `Completed`, `Failed`, `Cancelled` |
| `Completed` | `Refunded`, `PartiallyRefunded` |
| `PartiallyRefunded` | `Refunded` |
| `Failed` | — (terminal) |
| `Cancelled` | — (terminal) |
| `Refunded` | — (terminal) |

### 8.2 Rules

#### BR-049 — Required payment data
- **Rule:** A payment must have a `reservation_id`, an `employee_id`, a
  `payment_amount` greater than or equal to zero, a `transaction_type`, a
  `payment_type`, and a `payment_method`. `payment_status` defaults to `Pending` and
  `payment_date` defaults to the current timestamp.
- **Entities:** `payment`
- **Enforcement:** `NOT NULL` and `CHECK (payment_amount >= 0)` in the DDL.

#### BR-050 — Transaction, payment, and method values
- **Rule:** The allowed values are:
  - `transaction_type`: `Payment`, `Refund`, `Adjustment`, `Reversal`.
  - `payment_type`: `Deposit`, `PartialPayment`, `FullPayment`, `BalancePayment`,
    `AdditionalCharge`.
  - `payment_method`: `Cash`, `CreditCard`, `DebitCard`, `GCash`, `Maya`,
    `BankTransfer`, `OnlineBanking`, `Other`.
- **Entities:** `payment`
- **Enforcement:** Enums in the DDL.

#### BR-051 — Payment status transitions
- **Rule:** Only the transitions in Section 8.1 are allowed. A payment is not counted
  as received until `payment_status = 'Completed'`.
- **Entities:** `payment`
- **Enforcement:** Application-level state machine; the enum constrains values only.

#### BR-052 — Completed payments count toward the balance
- **Rule:** Only `Completed` `Payment` transactions increase `net_paid`, and only
  `Completed` `Refund` transactions decrease it. `Pending`, `Processing`, `Failed`, and
  `Cancelled` records do not affect the balance.
- **Entities:** `payment`
- **Enforcement:** Application-level aggregation (BR-047).

#### BR-053 — Deposits, partial payments, and overpayment
- **Rule:** A reservation may receive a `Deposit`, one or more `PartialPayment`
  transactions, and a final `FullPayment`/`BalancePayment`. The number of payments is
  not limited. A payment must not exceed the outstanding balance unless an
  Administrator approves and audits an explicit correction.
- **Entities:** `payment`, `reservation`
- **Enforcement:** Application-level balance check; the DDL has no balance column or
  overpayment constraint.

#### BR-054 — Refunds
- **Rule:** A refund may be recorded only against a completed payment of the same
  reservation. The refund amount must not exceed the net amount paid, and it is stored
  as a positive `payment_amount` with `transaction_type = 'Refund'`. The original
  payment's status becomes `PartiallyRefunded` or `Refunded` as appropriate. Refunds
  must be audited. The DDL has no link from a refund to the original payment, so the
  relationship must be recorded in the audit description.
- **Entities:** `payment`, `reservation`, `audit_log`
- **Enforcement:** Application-level validation; amounts remain non-negative.

#### BR-055 — Allowed reservation states for financial transactions
- **Rule:** New payments may be recorded for `Pending`, `Confirmed`, `CheckedIn`, or
  `CheckedOut` reservations while the account is open. Refunds may also be recorded for
  `Cancelled` or `NoShow` reservations that have completed payments. New charges
  follow BR-043.
- **Entities:** `payment`, `reservation`
- **Enforcement:** Application-level status check.

#### BR-056 — The processing employee is recorded
- **Rule:** Every payment records the employee who processed it. The employee record is
  historical and must not be deleted (BR-007).
- **Entities:** `payment`, `employee`
- **Enforcement:** `NOT NULL` foreign key with `ON DELETE RESTRICT`.

#### BR-057 — Payments are not deleted; use refunds or reversals
- **Rule:** A completed payment must not be hard-deleted. Staff refund it as a
  `Refund` transaction (BR-054). An Administrator may record an audited
  `Adjustment`/`Reversal` as an administrative correction after review (BR-081); these
  transactions are not part of routine Staff payment entry (BR-005). The DDL permits
  deletion of a payment row, so the no-deletion policy is application-level.
  The effect of `Adjustment` and `Reversal` on the derived balance is unresolved
  (gap G-07).
- **Entities:** `payment`, `audit_log`
- **Enforcement:** Application policy and authorization; no DDL protection against
  deleting a payment row.

---

## 9. Check-in and Check-out

#### BR-058 — Check-in preconditions
- **Rule:** Check-in is allowed only when the reservation is `Confirmed`. A `Pending`,
  `Cancelled`, `NoShow`, `CheckedIn`, or `CheckedOut` reservation cannot be checked in.
- **Entities:** `reservation`, `reserved_kubo`
- **Enforcement:** Application-level state check.

#### BR-059 — Check-in date and early check-in
- **Rule:** Check-in normally occurs on the assignment's `check_in_date`. Check-in
  before that date is allowed only when `early_check_in_approved = true` has been set by
  an authorized employee and the approval is audited. Check-in must not occur on or
  after `check_out_date`. Scheduled times are advisory, not hard constraints.
- **Entities:** `reserved_kubo`, `audit_log`
- **Enforcement:** Application-level validation. The DDL stores the approval boolean
  but does not enforce the date rule.

#### BR-060 — Recording check-in
- **Rule:** Check-in records `actual_check_in_datetime`, sets the assignment's
  `reserved_kubo.status = 'CheckedIn'`, and changes the kubo's status to `Occupied`.
  When the first assignment of a reservation is checked in, the reservation status
  becomes `CheckedIn`. The operation is audited.
- **Entities:** `reserved_kubo`, `kubo`, `reservation`, `audit_log`
- **Enforcement:** Application-level transactional update.

#### BR-061 — Kubo readiness at check-in
- **Rule:** A kubo may be checked in only when its current status is `Available` or
  `Reserved`. A kubo in `Maintenance`, `OutOfService`, `UnderInspection`, `Cleaning`,
  or `Occupied` cannot be checked in until it is returned to an assignable state.
- **Entities:** `kubo`, `reserved_kubo`
- **Enforcement:** Application-level status check.

#### BR-062 — Check-out preconditions
- **Rule:** Check-out is allowed only for an assignment whose
  `reserved_kubo.status = 'CheckedIn'` and whose reservation is `CheckedIn`.
- **Entities:** `reserved_kubo`, `reservation`
- **Enforcement:** Application-level state check.

#### BR-063 — Recording check-out and reserving status aggregation
- **Rule:** Check-out records `actual_check_out_datetime`, sets the assignment status to
  `CheckedOut`, and updates the kubo (normally to `Cleaning`, then `Available` when
  ready). The reservation becomes `CheckedOut` only when every assignment is in a
  terminal state (`CheckedOut`, `Cancelled`, or `NoShow`) and at least one assignment
  was checked out. The operation is audited.
- **Entities:** `reserved_kubo`, `kubo`, `reservation`, `audit_log`
- **Enforcement:** Application-level transactional update.

#### BR-064 — Settlement at check-out
- **Rule:** Before the reservation is marked `CheckedOut`, all chargeable items must be
  recorded and the outstanding balance should be zero. If the resort permits
  pay-after-stay, the project owner must define the exception policy; the schema has no
  override flag. Any exception must be approved by an Administrator and audited.
- **Entities:** `additional_charge`, `payment`, `reservation`, `audit_log`
- **Enforcement:** **Assumption** (A-04). Application-level policy; not enforced by the
  DDL.

#### BR-065 — Partial and multiple-kubo stays
- **Rule:** A reservation with multiple kubos supports per-assignment check-in and
  check-out. One assignment may be checked in or out while another is not. The
  reservation-level status reflects the aggregate described in BR-060 and BR-063.
- **Entities:** `reservation`, `reserved_kubo`
- **Enforcement:** Application-level aggregation.

#### BR-066 — Actual timestamp consistency
- **Rule:** When both actual timestamps exist, `actual_check_out_datetime` must be later
  than `actual_check_in_datetime`. The check-in timestamp must not be after the stay's
  `check_out_date`, and the check-out timestamp must not be before `check_in_date`.
- **Entities:** `reserved_kubo`
- **Enforcement:** Application-level validation. The DDL has no check constraint tying
  actual timestamps to the booked dates.

---

## 10. Audit, Data Integrity, and Concurrency

#### BR-067 — Events that must be audited
- **Rule:** At minimum, audit the following:
  - reservation creation, confirmation, modification, cancellation, no-show,
    check-in, and check-out;
  - changes to kubo types, rates, and kubos;
  - employee account creation, updates (names, username, password reset, status, and
    role assignment), and role changes;
  - payment and refund creation or status changes;
  - additional-charge creation and corrections;
  - successful login and logout; and
  - administrative deletions or corrections.
- **Entities:** `audit_log`
- **Enforcement:** Application-level; the DDL does not create audit rows
  automatically.

#### BR-068 — Audit record contents
- **Rule:** Every audit record must have an `employee_id`, an `action` from the
  `audit_action` enum, an `entity_type`, and an `entity_id`. `description`,
  `old_values`, and `new_values` are optional but should be populated for updates. The
  `entity_type`/`entity_id` pair must identify the affected record consistently.
  `created_at` defaults to the current timestamp.
- **Entities:** `audit_log`
- **Enforcement:** `NOT NULL` constraints in the DDL; consistency is application-level.

#### BR-069 — Audit log is append-only
- **Rule:** Audit records must never be updated or deleted through the application.
- **Entities:** `audit_log`
- **Enforcement:** Application policy. The DDL does not prevent updates or deletes, so
  database permissions/triggers would be required for hard enforcement.

#### BR-070 — Sensitive data must not be logged
- **Rule:** `password_hash`, plaintext passwords, and other credentials must never
  appear in `audit_log`, application logs, or API responses. Audit `old_values` and
  `new_values` must exclude secrets.
- **Entities:** `employee`, `audit_log`
- **Enforcement:** Application-level redaction.

#### BR-071 — Multi-table operations are atomic
- **Rule:** Operations that span multiple tables must commit or roll back as one
  transaction. This includes reservation creation, reservation updates, cancellation,
  check-in, check-out, payment/refund with status changes, and any audit write that is
  part of the operation.
- **Entities:** `reservation`, `reserved_kubo`, `kubo`, `payment`,
  `additional_charge`, `audit_log`
- **Enforcement:** PostgreSQL function/procedure with a transaction, per
  `docs/database.md`.

#### BR-072 — Referential deletion restrictions
- **Rule:** The following records must not be deleted while referenced:
  - `role` while employees reference it;
  - `employee` while reservations, payments, charges, or audit entries reference it;
  - `guest` while reservations reference it;
  - `kubo_type` while kubos reference it;
  - `kubo` while reserved-kubo assignments reference it;
  - `reservation` while payments or additional charges reference it.

  Retain history through status values instead of deletion.
- **Entities:** all tables
- **Enforcement:** Foreign keys with `ON DELETE RESTRICT` in the DDL, except
  `reserved_kubo.reservation_id`, which uses `ON DELETE CASCADE`.

#### BR-073 — Timestamps
- **Rule:** `created_at`, `reserved_at`, `payment_date`, `charge_date`, and audit
  `created_at` are system-generated and must not be supplied by the client.
  `updated_at` is application-managed; the DDL has no update trigger.
- **Entities:** `guest`, `employee`, `reservation`, `payment`, `additional_charge`,
  `audit_log`
- **Enforcement:** Defaults in the DDL; client-side immutability and `updated_at`
  maintenance are application-level.

#### BR-074 — Concurrency and status consistency
- **Rule:** Availability, payment, and status-changing operations must serialize on the
  affected records. Whenever a `reserved_kubo` state changes, the parent reservation
  and the kubo's operational status must be updated consistently in the same
  transaction. No committed state may contain a checked-in assignment under a cancelled
  or checked-out reservation.
- **Entities:** `reservation`, `reserved_kubo`, `kubo`, `payment`
- **Enforcement:** Transaction boundaries and row locks in the service/procedure;
  application-level state machine.

#### BR-075 — Consistency between reservation and assignment statuses
- **Rule:** The following combinations must hold:

  | Reservation status | Required child assignment statuses |
  |---|---|
  | `Pending` | `Reserved` |
  | `Confirmed` | `Reserved` |
  | `CheckedIn` | At least one `CheckedIn`; remaining `Reserved`, `CheckedOut`, `Cancelled`, or `NoShow` |
  | `CheckedOut` | All terminal (`CheckedOut`, `Cancelled`, or `NoShow`), at least one `CheckedOut` |
  | `Cancelled` | All `Cancelled` |
  | `NoShow` | All `NoShow` |

- **Entities:** `reservation`, `reserved_kubo`
- **Enforcement:** Application-level invariant; the DDL does not enforce cross-row
  status consistency.

---

## 11. Administrative Functions and Reporting

#### BR-076 — Administrator scope
- **Rule:** Administrators manage employees and roles, kubo types, kubos, and rates;
  review reservations read-only; review the audit log; and manage additional charges
  through review and audited corrections. They do **not** create or modify
  reservations, record operational charges or payments/refunds, or check guests in or
  out. Administrative changes must be audited.
- **Entities:** `employee`, `role`, `kubo_type`, `kubo`, `additional_charge`,
  `audit_log`
- **Enforcement:** Authorization layer.

#### BR-077 — Staff cannot perform administrative actions
- **Rule:** Staff must not create or modify employees, roles, kubo types, kubos, or
  rates; must not view the audit log; and must not record administrative
  charge corrections. Attempts must be rejected and may be audited. Conversely,
  Administrators must not perform Staff operations (BR-005).
- **Entities:** `employee`, `role`, `kubo_type`, `kubo`, `additional_charge`,
  `audit_log`
- **Enforcement:** Authorization layer.

#### BR-078 — Administrative review uses the audit log
- **Rule:** The old `last_audit_date` field no longer exists. Administrators review
  administrative and reservation activity through the append-only `audit_log`, filtered
  by `employee_id`, `entity_type`, `entity_id`, `action`, and date.
- **Entities:** `audit_log`, `employee`
- **Enforcement:** Read-only application queries; no new table is required.

#### BR-079 — Reports are derived, not stored
- **Rule:** Reservation, occupancy, revenue, and payment summaries must be derived from
  the operational tables. The schema has no reporting, snapshot, or configuration
  tables. Reports must respect the same role permissions as the underlying data.
- **Entities:** all tables
- **Enforcement:** Read-only queries; no schema additions.

#### BR-080 — Employee and role administration
- **Rule:** Only an Administrator may create, update, deactivate, or terminate
  employee accounts; assign roles; reset passwords; and create, rename, or delete
  roles. The following conditions apply:
  1. Required employee fields and unique `username` follow BR-002; passwords follow
     BR-003 and are stored only as hashes.
  2. `status` must be a value of the `employee_status` enum and follows BR-004.
  3. The last `Active` Administrator must not be deactivated, terminated, or assigned
     another role (BR-006).
  4. An employee with references from reservations, payments, charges, or audit
     entries must not be hard-deleted; set `status = 'Terminated'` instead
     (BR-007, BR-072).
  5. A role referenced by any employee must not be deleted; employees must be
     reassigned first (BR-008, BR-072).
  6. Passwords and `password_hash` must never be returned by the API or written to
     audit/log output (BR-003, BR-070).

  Every employee or role change must be audited (BR-067).
- **Entities:** `employee`, `role`, `audit_log`
- **Enforcement:** Application/authorization layer. Uniqueness, foreign keys, enum
  values, and `ON DELETE RESTRICT` are enforced by the DDL; last-Administrator,
  credential, and separation rules are application-level.

#### BR-081 — Administrative additional-charge management
- **Rule:** Administrators may view all additional charges and record audited
  corrections when a charge is disputed, mis-keyed, or must be adjusted. Existing
  charge rows must not be edited or deleted by an Administrator; every correction is
  a new record (BR-046). Specifically:
  - an **increase** in the amount owed is recorded as a new `additional_charge` with
    a reason in `description`;
  - a **reduction** cannot be stored as a negative `additional_charge` because
    `amount >= 0`; it must be recorded as a `payment` with
    `transaction_type = 'Adjustment'` or `'Reversal'` and the required
    `payment_type`/`payment_method` (BR-049), whose balance semantics remain
    unresolved (G-07); and
  - the correction must be attributable to the Administrator through `employee_id`
    and must be audited (BR-067, BR-068).

  Routine operational charge entry remains a Staff operation (BR-042–BR-046).
- **Entities:** `additional_charge`, `payment`, `audit_log`
- **Enforcement:** Application authorization, append-only policy, and audit trail.
  The DDL has no charge status or approval field (G-16).

#### BR-082 — Administrator reservation review is read-only
- **Rule:** Administrators may retrieve and view reservations, assignments, charges,
  payments, and derived balances for oversight and reporting, but must not create,
  modify, cancel, or mark no-show a reservation, and must not check a guest in or out.
  Operational corrections must be performed by Staff; financial corrections follow
  BR-081.
- **Entities:** `reservation`, `reserved_kubo`, `payment`, `additional_charge`
- **Enforcement:** Authorization layer; read-only queries.

---

## 12. Database Entity Reference

| Table | Purpose | Key rules |
|---|---|---|
| `role` | Role names | BR-001, BR-008, BR-080 |
| `employee` | System users | BR-002–BR-007, BR-080 |
| `guest` | Guests | BR-009–BR-015 |
| `kubo_type` | Accommodation types and nightly rates | BR-016, BR-019, BR-020, BR-022 |
| `kubo` | Individual accommodation units | BR-017, BR-021, BR-023 |
| `reservation` | Booking header | BR-024–BR-028, BR-033–BR-038 |
| `reserved_kubo` | Kubo assignments, dates, price snapshot, per-kubo status | BR-029–BR-032, BR-058–BR-066 |
| `payment` | Payments, refunds, adjustments, reversals | BR-049–BR-057 |
| `additional_charge` | Extra bill items | BR-042–BR-046, BR-081 |
| `audit_log` | Append-only activity trail | BR-067–BR-070, BR-078 |

---

## 13. Assumptions Requiring Owner Confirmation

| ID | Assumption | Impact if wrong |
|---|---|---|
| **A-01** | The two roles are named `Administrator` and `Staff`; the old `Owner` role maps to `Administrator`. | Seed data, UI labels, and authorization checks must change. |
| **A-02** | `reserved_kubo.price_at_booking` stores the **nightly rate** snapshot, not the total stay price. | Pricing formula, invoices, and reports would change. |
| **A-03** | All monetary amounts are in PHP and use two decimal places. | Currency display and rounding rules would change. |
| **A-04** | Check-out normally requires a zero outstanding balance; pay-after-stay requires explicit owner policy. | Check-out blocking and exception handling would change. |
| **A-05** | At most one active Administrator is required (old "one Owner" rule). | Multiple administrator accounts may be allowed. |
| **A-06** | Confirmation does not require a deposit; deposits are optional. | Confirmation rules would change. |
| **A-07** | Kubos in `Maintenance`, `OutOfService`, or `UnderInspection` are excluded from availability for all dates. `Cleaning`, `Occupied`, and `Reserved` do not block future date ranges. | Availability results would change, especially for future maintenance. |
| **A-08** | A Pending reservation's assignments are considered `Reserved` and therefore block overlapping bookings. | Tentative bookings might be allowed to overlap. |
| **A-09** | Staff may view all reservations needed for operations; the schema has no per-staff assignment scope. | Additional data-scoping rules would be needed. |
| **A-10** | The password policy remains 6–12 alphanumeric characters as documented in the old rule; this is weak by current standards and should be revisited. | Password validation rules would change. |
| **A-11** | "Philippine contact number" validation applies to `guest.phone`; the schema has no employee phone field. | Phone validation scope would change. |

---

## 14. Identified Design Gaps

| ID | Gap | Consequence |
|---|---|---|
| **G-01** | No exclusion constraint or unique constraint prevents overlapping `reserved_kubo` date ranges. | Double bookings are possible unless the application/procedure checks and locks atomically. |
| **G-02** | No `is_active` flag on `kubo_type`. | A kubo type cannot be deactivated; only its kubos can be taken out of service. |
| **G-03** | No unique constraint on (`valid_id_type`, `id_number`). | Duplicate guest IDs can be stored unless the application checks; concurrent requests can still race. |
| **G-04** | No soft-delete flag on `guest` or `kubo`. | Records without references can be hard-deleted; history policy must be enforced operationally. |
| **G-05** | No database constraint requires at least one `reserved_kubo` per reservation. | Header-only reservations are possible unless the procedure enforces the invariant. |
| **G-06** | The DDL has no `total_reservation_amount`, but the ERD/backend code still reference a total amount, and the ERD's `AUDIT_LOG` has `ip_address`, which the DDL lacks. | Totals must be derived; the ERD and backend schema are stale and must not be treated as the source of truth. |
| **G-07** | `payment` has no reference to an original payment, no description, and `Adjustment`/`Reversal` semantics are undefined. | Refund/reversal traceability is limited to the audit log; balance effects cannot be computed reliably. |
| **G-08** | No party-size/guest-count column on `reservation` or `reserved_kubo`. | The system cannot validate occupancy against `kubo_type.capacity`; staff must do it manually. |
| **G-09** | No shift schedule, attendance, `date_hired`, emergency-contact, or middle-initial fields (removed from the DDL). | Old staff-scheduling and attendance rules cannot be implemented. |
| **G-10** | No service/catalog table. | Old "Services" and `Reservation_Service` rules are unsupported; only free-form additional charges exist. |
| **G-11** | No Schedule table; availability is derived from `reserved_kubo`. | The old real-time schedule table rule cannot be implemented as described. |
| **G-12** | No separate cancellation table; cancellation is stored on `reservation`. | Old `Cancellation` entity rules are replaced by BR-035. |
| **G-13** | `audit_log.employee_id` is `NOT NULL`, so failed login attempts by unknown users cannot be recorded. | Authentication-failure auditing needs a schema change or a designated system employee. |
| **G-14** | No database triggers enforce status-transition or timestamp-consistency rules. | All lifecycle rules depend on the application/procedure layer. |
| **G-15** | No explicit `updated_at` trigger. | `updated_at` will be stale unless the application sets it on every update. |
| **G-16** | `additional_charge` has no status, void flag, approval field, or link to a correcting record. | Administrative corrections must be new audited records; reductions rely on `Adjustment`/`Reversal` transactions, whose balance effect is unresolved (G-07). |

---

## 15. Traceability to the Previous Rules

| Old rule | Disposition | New rules |
|---|---|---|
| a — unique username, 6–12 password, created_at | Retained, adapted to `employee` | BR-002, BR-003 |
| b — one role, Owner/Staff, name fields | Retained; middle initial removed | BR-001, BR-002 |
| c — one active Owner, emergency contact, last_audit_date | Partly retained as one active Administrator; removed fields dropped | BR-006, BR-078, A-05 |
| d — shift schedule, date_hired, employment state | Removed; fields no longer exist | — |
| e — time_in/time_out vs shift | Removed; no attendance tables | — |
| f — Customer name and PH contact number | Retained as guest | BR-009, BR-012 |
| g — valid ID types and unique ID per type | Retained; enum expanded; uniqueness is app-level | BR-011, G-03 |
| h — reservation guest/staff, no deletion on termination | Retained | BR-007, BR-027, BR-072 |
| i — table/time-slot/party-size reservation | Replaced by date-range kubo booking; party size unsupported | BR-029, BR-031, G-08 |
| j — reservation status and cancellation record | Revised to current enum and cancellation columns | BR-033, BR-035 |
| k — Services catalog and Reservation_Service | Removed; replaced by `additional_charge` | BR-042–BR-045, G-10 |
| l — cancellation reason/date, no re-confirmation | Retained | BR-035 |
| m — Schedule table | Removed; availability derived from `reserved_kubo` | BR-031, BR-032, G-11 |

---

## 16. Flowchart Reference

The companion diagrams are:

- `docs/system_flowcharts.drawio` — editable draw.io diagrams.
- `docs/system_flowcharts.md` — Mermaid versions.

| Diagram | Related rules |
|---|---|
| Overall System Flow | BR-001–BR-008, BR-067, BR-076–BR-082 |
| Reservation and Booking Flow (Staff) | BR-009–BR-020, BR-024–BR-034, BR-039–BR-040 |
| Reservation Management Flow (Staff) | BR-033–BR-038 |
| Kubo and Kubo Type Management Flow (Administrator) | BR-016–BR-023 |
| Rate and Pricing Management Flow (Administrator) | BR-018–BR-020, BR-039–BR-041 |
| Manage Employees and Roles Flow (Administrator) | BR-001–BR-008, BR-080 |
| Payment and Refund Flow (Staff) | BR-047–BR-057 |
| Additional Charge Flow (Staff) | BR-042–BR-048 |
| Additional Charge Management Flow (Administrator) | BR-046, BR-057, BR-081 |
| Check-in and Check-out Flow (Staff) | BR-058–BR-066 |
| Status Lifecycles | BR-021, BR-033, BR-051 |
