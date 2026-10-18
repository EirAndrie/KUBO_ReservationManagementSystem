# Kubo Reservation System — System Flowcharts (Mermaid)

Companion to `docs/system_flowcharts.drawio` and `docs/business_rules.md`.

- **Terminology:** *kubo* = accommodation unit, *kubo type* = accommodation category.
- **Rule references** such as `BR-031` point to `docs/business_rules.md`.
- **Database note:** Availability is derived from `reserved_kubo` date ranges. The
  diagrams assume the checks and writes run in one transaction (BR-032, BR-071).

---

## 1. Overall System Flow

```mermaid
flowchart TD
    S([Start]) --> P1["Employee accesses the system"]
    P1 --> D1{"Authenticated?"}
    D1 -->|No| P2["Show login form"]
    P2 --> P3["Validate username and password"]
    P3 --> D2{"Credentials valid<br/>and employee Active?<br/>(BR-003, BR-004)"}
    D2 -->|No| E1["Show error and retry"]
    E1 --> P2
    D2 -->|Yes| P4["Identify role from role table<br/>(BR-001)"]
    P4 --> A1["Audit successful login<br/>(BR-067)"]
    A1 --> D3{"Role?"}
    D3 -->|Administrator| ADM["Administrator dashboard"]
    D3 -->|Staff| STF["Staff dashboard"]

    ADM --> ADM1["Manage employees and roles<br/>(BR-008, BR-076)"]
    ADM --> ADM2["Manage kubo types, kubos, rates<br/>(BR-016–BR-023)"]
    ADM --> ADM3["Review reservations and audit log<br/>(BR-078)"]
    ADM --> ADM4["Perform staff operations"]

    STF --> STF1["Register or retrieve guests<br/>(BR-009–BR-015)"]
    STF --> STF2["Create and manage reservations<br/>(BR-024–BR-038)"]
    STF --> STF3["Check availability and assign kubos<br/>(BR-031–BR-032)"]
    STF --> STF4["Process payments and charges<br/>(BR-042–BR-057)"]
    STF --> STF5["Check-in and check-out<br/>(BR-058–BR-066)"]

    ADM1 --> AUD["Write audit log"]
    ADM2 --> AUD
    ADM3 --> AUD
    ADM4 --> AUD
    STF1 --> AUD
    STF2 --> AUD
    STF3 --> AUD
    STF4 --> AUD
    STF5 --> AUD
    AUD --> E2([End])
```

---

## 2. Reservation and Booking Flow

```mermaid
flowchart TD
    S([Start]) --> P1["Receive reservation request<br/>WalkIn, Online, Phone, Email, etc."]
    P1 --> P2["Retrieve existing guest by email/ID<br/>or register a new guest<br/>(BR-009–BR-013)"]
    P2 --> D1{"Guest details complete<br/>and valid?<br/>(BR-009–BR-012)"}
    D1 -->|No| P3["Capture required guest fields<br/>name, email, phone, ID type, ID number"]
    P3 --> D1
    D1 -->|Yes| P4["Select kubo type, check-in date,<br/>check-out date, booking source<br/>(BR-024, BR-026)"]
    P4 --> D2{"Dates valid?<br/>check-out later than check-in,<br/>not in the past<br/>(BR-029)"}
    D2 -->|No| E1["Reject request<br/>show date error"]
    D2 -->|Yes| P5["Check availability:<br/>exclude Maintenance / OutOfService /<br/>UnderInspection; reject overlapping<br/>Reserved or CheckedIn assignments<br/>(BR-031, A-07)"]
    P5 --> D3{"At least one kubo<br/>available?"}
    D3 -->|No| P6["Offer alternative kubo, type,<br/>or dates"]
    P6 --> P4
    D3 -->|Yes| P7["Calculate price:<br/>nights × kubo_type.price_per_night<br/>snapshot into price_at_booking<br/>(BR-030, BR-039)"]
    P7 --> D4{"Guest accepts<br/>quote?"}
    D4 -->|No| E2["End: not booked"]
    D4 -->|Yes| P8["Create reservation as Pending<br/>and reserved_kubo assignments<br/>in one transaction<br/>(BR-024, BR-028, BR-032, BR-071)"]
    P8 --> D5{"Deposit or payment<br/>now?"}
    D5 -->|Yes| P9["Process payment<br/>(Payment and Refund Flow)"]
    D5 -->|No| D6
    P9 --> D6{"Confirm reservation<br/>now?"}
    D6 -->|Yes| P10["Set reservation to Confirmed<br/>(BR-034)"]
    D6 -->|No| P11["Leave reservation as Pending"]
    P10 --> P12["Audit reservation creation<br/>and confirmation<br/>(BR-067)"]
    P11 --> P12
    P12 --> E3([End: reservation created])

    style E1 fill:#f8cecc,stroke:#b85450
    style E2 fill:#f8cecc,stroke:#b85450
```

---

## 3. Reservation Management Flow

```mermaid
flowchart TD
    S([Start]) --> P1["Retrieve reservation by reference code<br/>or guest details"]
    P1 --> P2["Display reservation, assignments,<br/>payments, charges, and balance"]
    P2 --> D1{"Select action"}

    D1 -->|View| V1["Read-only view"] --> E1([End])
    D1 -->|Update details| U1{"Status Pending or<br/>Confirmed and not checked in?<br/>(BR-037)"}
    D1 -->|Cancel| C1{"Status Pending or<br/>Confirmed?<br/>(BR-035)"}
    D1 -->|Check-in| I1["Go to Check-in Flow<br/>(BR-058–BR-061)"]
    D1 -->|Check-out| O1["Go to Check-out Flow<br/>(BR-062–BR-066)"]
    D1 -->|Mark no-show| N1{"Status Confirmed and<br/>scheduled check-in passed?<br/>(BR-036)"}

    U1 -->|No| E2["Reject change"]
    U1 -->|Yes| U2["Validate new dates and availability;<br/>re-snapshot changed assignments<br/>(BR-029, BR-031, BR-037)"]
    U2 --> U3{"Valid and available?"}
    U3 -->|No| E3["Reject change"]
    U3 -->|Yes| U4["Update reservation and assignments<br/>in one transaction"]
    U4 --> AUD["Audit change"]
    AUD --> E4([End])

    C1 -->|No| E5["Reject cancellation"]
    C1 -->|Yes| C2["Capture cancellation reason"]
    C2 --> C3["Set status Cancelled, cancelled_at,<br/>reason; set child assignments Cancelled;<br/>release kubos<br/>(BR-035)"]
    C3 --> C4["Refund handling if payments exist<br/>(BR-054)"]
    C4 --> AUD
    AUD --> E4

    N1 -->|No| E6["Reject no-show"]
    N1 -->|Yes| N2["Set reservation and assignments<br/>to NoShow<br/>(BR-036)"]
    N2 --> AUD
    AUD --> E4

    I1 --> E7([Continue in check-in flow])
    O1 --> E8([Continue in check-out flow])

    style E2 fill:#f8cecc,stroke:#b85450
    style E3 fill:#f8cecc,stroke:#b85450
    style E5 fill:#f8cecc,stroke:#b85450
    style E6 fill:#f8cecc,stroke:#b85450
```

---

## 4. Kubo and Kubo Type Management Flow

```mermaid
flowchart TD
    S([Start]) --> P1["Administrator opens configuration<br/>(BR-018, BR-076)"]
    P1 --> D1{"Manage kubo type<br/>or kubo?"}

    D1 -->|Kubo type| T1["Enter type_name, capacity,<br/>price_per_night, description"]
    T1 --> D2{"type_name unique,<br/>capacity > 0,<br/>price >= 0?<br/>(BR-016)"}
    D2 -->|No| E1["Reject and show validation error"]
    D2 -->|Yes| T2["Create or update kubo_type"]
    T2 --> D3{"Delete type requested?"}
    D3 -->|No| AUD["Audit configuration change"]
    D3 -->|Yes| D4{"Any kubo references<br/>this type?<br/>(BR-022)"}
    D4 -->|Yes| E2["Block deletion;<br/>take kubos OutOfService instead"]
    D4 -->|No| T3["Delete kubo_type"]
    T3 --> AUD
    E2 --> AUD

    D1 -->|Kubo| K1["Enter kubo_number, kubo_type_id,<br/>and/or new status"]
    K1 --> D5{"kubo_number unique<br/>and kubo_type exists?<br/>(BR-017)"}
    D5 -->|No| E3["Reject and show validation error"]
    D5 -->|Yes| D6{"Operation"}

    D6 -->|Create / update| K2["Save kubo"]
    D6 -->|Change status| K3{"Allowed status<br/>transition?<br/>(BR-021)"}
    K3 -->|No| E4["Reject status change"]
    K3 -->|Yes| K4["Update kubo.status"]
    D6 -->|Delete| K5{"Referenced by<br/>reserved_kubo?<br/>(BR-023)"}
    K5 -->|Yes| E5["Block deletion;<br/>set OutOfService instead"]
    K5 -->|No| K6["Delete kubo"]

    K2 --> AUD
    K4 --> AUD
    K6 --> AUD
    E4 --> AUD
    E5 --> AUD
    AUD --> E6([End])

    style E1 fill:#f8cecc,stroke:#b85450
    style E2 fill:#f8cecc,stroke:#b85450
    style E3 fill:#f8cecc,stroke:#b85450
    style E4 fill:#f8cecc,stroke:#b85450
    style E5 fill:#f8cecc,stroke:#b85450
```

---

## 5. Rate and Pricing Management Flow

```mermaid
flowchart TD
    S([Start]) --> P1["Administrator selects kubo type<br/>(BR-018)"]
    P1 --> P2["Display current price_per_night<br/>and capacity"]
    P2 --> P3["Enter new price_per_night"]
    P3 --> D1{"Price >= 0 and<br/>at most 2 decimals?<br/>(BR-016, BR-048)"}
    D1 -->|No| E1["Reject price"]
    D1 -->|Yes| D2{"Confirm rate change?"}
    D2 -->|No| E2["Cancel change"]
    D2 -->|Yes| P4["Update kubo_type.price_per_night"]
    P4 --> P5["Existing reserved_kubo.price_at_booking<br/>remains unchanged<br/>(BR-020)"]
    P5 --> P6["New assignments use the new rate<br/>(BR-020, BR-039)"]
    P6 --> P7["Audit rate change<br/>(BR-067)"]
    P7 --> E3([End])

    style E1 fill:#f8cecc,stroke:#b85450
    style E2 fill:#f8cecc,stroke:#b85450
```

---

## 6. Payment and Refund Flow

```mermaid
flowchart TD
    S([Start]) --> P1["Staff selects a reservation and<br/>reviews charges and outstanding balance<br/>(BR-047)"]
    P1 --> D1{"Reservation status allows<br/>this transaction?<br/>(BR-055)"}
    D1 -->|No| E1["Reject transaction"]
    D1 -->|Yes| P2["Select transaction type,<br/>payment type, method, and amount<br/>(BR-050)"]
    P2 --> D2{"Amount >= 0 and<br/>not greater than outstanding?<br/>(BR-049, BR-053)"}
    D2 -->|No| E2["Reject amount"]
    D2 -->|Yes| P3["Record payment as Pending<br/>or Processing<br/>(BR-049, BR-051)"]
    P3 --> D3{"Payment successful?"}
    D3 -->|No| P4["Set Failed or Cancelled<br/>(does not affect balance)"]
    P4 --> AUD["Audit payment result"]
    D3 -->|Yes| P5["Set Completed"]
    P5 --> P6["Recalculate net_paid<br/>and outstanding balance<br/>(BR-047, BR-052)"]
    P6 --> D4{"Refund needed?"}
    D4 -->|Yes| R1{"Original payment Completed<br/>and refund <= net paid?<br/>(BR-054)"}
    R1 -->|No| E3["Reject refund"]
    R1 -->|Yes| R2["Record Refund with positive amount;<br/>set original to PartiallyRefunded<br/>or Refunded<br/>(BR-054)"]
    R2 --> AUD
    D4 -->|No| AUD
    AUD --> E4([End])

    style E1 fill:#f8cecc,stroke:#b85450
    style E2 fill:#f8cecc,stroke:#b85450
    style E3 fill:#f8cecc,stroke:#b85450
```

---

## 7. Check-in and Check-out Flow

```mermaid
flowchart TD
    subgraph CheckIn["Check-in"]
        S1([Start]) --> P1["Staff retrieves reservation<br/>and assignment"]
        P1 --> D1{"Reservation Confirmed?<br/>(BR-058)"}
        D1 -->|No| E1["Reject check-in"]
        D1 -->|Yes| D2{"Current date is check-in date,<br/>or early check-in approved?<br/>(BR-059)"}
        D2 -->|No| P2["Request early check-in approval"]
        P2 --> D2
        D2 -->|Yes| D3{"Kubo status Available<br/>or Reserved?<br/>(BR-061)"}
        D3 -->|No| E2["Reject check-in;<br/>resolve kubo status"]
        D3 -->|Yes| P3["Record actual_check_in_datetime;<br/>set assignment CheckedIn;<br/>set kubo Occupied<br/>(BR-060)"]
        P3 --> D4{"First assignment<br/>checked in?"}
        D4 -->|Yes| P4["Set reservation CheckedIn"]
        D4 -->|No| P5["Keep reservation CheckedIn"]
        P4 --> P6["Audit check-in"]
        P5 --> P6
        P6 --> E3([End: checked in])
    end

    subgraph CheckOut["Check-out"]
        S2([Start]) --> P7["Staff retrieves checked-in assignment"]
        P7 --> D5{"Assignment CheckedIn?<br/>(BR-062)"}
        D5 -->|No| E4["Reject check-out"]
        D5 -->|Yes| D6{"Outstanding balance zero?<br/>(BR-064, A-04)"}
        D6 -->|No| P8["Record final charges and<br/>process payment"]
        P8 --> D6
        D6 -->|Yes| P9["Record actual_check_out_datetime;<br/>set assignment CheckedOut;<br/>set kubo Cleaning/Available<br/>(BR-063)"]
        P9 --> D7{"All assignments terminal?"}
        D7 -->|Yes| P10["Set reservation CheckedOut"]
        D7 -->|No| P11["Keep reservation CheckedIn"]
        P10 --> P12["Audit check-out"]
        P11 --> P12
        P12 --> E5([End: checked out])
    end

    style E1 fill:#f8cecc,stroke:#b85450
    style E2 fill:#f8cecc,stroke:#b85450
    style E4 fill:#f8cecc,stroke:#b85450
```

---

## 8. Status Lifecycles

### 8.1 Reservation status

```mermaid
stateDiagram-v2
    [*] --> Pending : create (BR-024)
    Pending --> Confirmed : confirm (BR-034)
    Pending --> Cancelled : cancel (BR-035)
    Confirmed --> CheckedIn : check in (BR-060)
    Confirmed --> Cancelled : cancel (BR-035)
    Confirmed --> NoShow : no-show (BR-036)
    CheckedIn --> CheckedOut : check out (BR-063)
    CheckedOut --> [*]
    Cancelled --> [*]
    NoShow --> [*]
```

### 8.2 Reserved-kubo assignment status

```mermaid
stateDiagram-v2
    [*] --> Reserved : assign (BR-030)
    Reserved --> CheckedIn : check in (BR-060)
    Reserved --> Cancelled : reservation cancelled (BR-035)
    Reserved --> NoShow : reservation no-show (BR-036)
    CheckedIn --> CheckedOut : check out (BR-063)
    CheckedOut --> [*]
    Cancelled --> [*]
    NoShow --> [*]
```

### 8.3 Payment status

```mermaid
stateDiagram-v2
    [*] --> Pending : record (BR-049)
    Pending --> Processing : begin processing
    Pending --> Completed : complete
    Pending --> Failed : fail
    Pending --> Cancelled : cancel
    Processing --> Completed : complete
    Processing --> Failed : fail
    Processing --> Cancelled : cancel
    Completed --> PartiallyRefunded : partial refund (BR-054)
    Completed --> Refunded : full refund (BR-054)
    PartiallyRefunded --> Refunded : remaining refund (BR-054)
    Failed --> [*]
    Cancelled --> [*]
    Refunded --> [*]
```

### 8.4 Kubo operational status

```mermaid
stateDiagram-v2
    [*] --> Available : create (BR-017)
    Available --> Reserved : reservation confirmed / current hold
    Available --> Occupied : check in (BR-060)
    Available --> Cleaning : housekeeping
    Available --> Maintenance : maintenance
    Available --> UnderInspection : inspection
    Available --> OutOfService : take out of service
    Reserved --> Occupied : check in (BR-060)
    Reserved --> Available : reservation cancelled / released
    Reserved --> Maintenance : maintenance
    Reserved --> UnderInspection : inspection
    Reserved --> OutOfService : take out of service
    Occupied --> Cleaning : check out (BR-063)
    Occupied --> Maintenance : maintenance
    Occupied --> UnderInspection : inspection
    Occupied --> OutOfService : take out of service
    Cleaning --> Available : ready
    Cleaning --> Maintenance : maintenance
    Cleaning --> UnderInspection : inspection
    Cleaning --> OutOfService : take out of service
    Maintenance --> Available : returned to service
    UnderInspection --> Available : passed inspection
    OutOfService --> Available : returned to service
```
