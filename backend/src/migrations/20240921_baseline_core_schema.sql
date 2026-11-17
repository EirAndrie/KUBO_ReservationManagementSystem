/*
  Migration: 20240921_baseline_core_schema.sql
  --------------------------------------------
  Baseline for the core tables that the original database provided before
  migrations were introduced: kubo_type, kubo, guest, employee, reservation,
  reserved_kubo, payment, additional_charge and audit_log, plus their enum
  types. It runs right after 20240920_create_role_schema.sql (which creates the
  `kubo` schema and `role`) so a brand-new database can be built from this
  repository alone.

  Idempotent by design. On a database that already has these objects (every
  existing environment) it changes nothing: enums, tables, constraints and
  indexes are only created when missing, and constraints are matched by name.

  Scope: only the shape the later migrations expect to find. Columns, checks,
  indexes, triggers and routines that later migrations add are NOT created here
  (for example additional_charge.catalog_id/request_id/quantity/unit_amount,
  payment.description/related_payment_id/related_charge_id/payment_reference,
  the charge catalog/request tables, the overlap exclusion constraint, and the
  charge_request_status enum), so those migrations still own them.
*/

-- Routine schemas that the "harden"/"wire" migrations require to exist before
-- they install their routines (each skips itself when its schema is missing).
-- The audit, auth, payment and reservation schemas are created by their own
-- migrations.
CREATE SCHEMA IF NOT EXISTS kubo_additional_charges_management;
CREATE SCHEMA IF NOT EXISTS kubo_employee_management;
CREATE SCHEMA IF NOT EXISTS kubo_guest_management;
CREATE SCHEMA IF NOT EXISTS kubo_kubo_type_management;
CREATE SCHEMA IF NOT EXISTS kubo_management;
CREATE SCHEMA IF NOT EXISTS kubo_role_management;

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT * FROM (VALUES
            ('audit_action',        ARRAY['Create','Update','Delete','Login','Logout','Cancel','Approve','Reject']),
            ('booking_source',      ARRAY['WalkIn','Online','Phone','Email','Facebook','TravelAgency','Referral','Other']),
            ('charge_type',         ARRAY['ExtraBed','ExtraPerson','LateCheckOut','EarlyCheckIn','RoomService','FoodAndBeverage','Laundry','CleaningFee','Damage','LostKey','LostItem','Transportation','Minibar','Other']),
            ('kubo_status',         ARRAY['Available','Reserved','Occupied','Maintenance','OutOfService','Cleaning','UnderInspection']),
            ('payment_method',      ARRAY['Cash','CreditCard','DebitCard','GCash','Maya','BankTransfer','OnlineBanking','Other']),
            ('payment_status',      ARRAY['Pending','Processing','Completed','Failed','Cancelled','Refunded','PartiallyRefunded']),
            ('payment_type',        ARRAY['Deposit','PartialPayment','FullPayment','BalancePayment','AdditionalCharge']),
            ('reservation_status',  ARRAY['Pending','Confirmed','CheckedIn','CheckedOut','Cancelled','NoShow']),
            ('reserved_kubo_status',ARRAY['Reserved','CheckedIn','CheckedOut','Cancelled','NoShow']),
            ('role_status',         ARRAY['Active','Inactive','Suspended','OnLeave','Terminated']),
            ('transaction_type',    ARRAY['Payment','Refund','Adjustment','Reversal']),
            ('valid_id_type',       ARRAY['Passport','DriverLicense','NationalID','PhilHealthID','SSSID','UMID','PostalID','PRCID','VotersID','SeniorCitizenID','StudentID','Other'])
        ) AS v(name, labels)
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_type ty
            JOIN pg_namespace n ON n.oid = ty.typnamespace
            WHERE n.nspname = 'kubo' AND ty.typname = t.name
        ) THEN
            EXECUTE format(
                'CREATE TYPE kubo.%I AS ENUM (%s)',
                t.name,
                (SELECT string_agg(quote_literal(l), ', ') FROM unnest(t.labels) AS l)
            );
        END IF;
    END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- Tables (created in dependency order)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kubo.kubo_type (
    kubo_type_id    uuid DEFAULT gen_random_uuid() NOT NULL,
    type_name       character varying(100) NOT NULL,
    capacity        integer NOT NULL,
    price_per_night numeric(10,2) NOT NULL,
    description     character varying(255),
    CONSTRAINT kubo_type_capacity_check CHECK (capacity > 0),
    CONSTRAINT kubo_type_price_check CHECK (price_per_night >= 0)
);

CREATE TABLE IF NOT EXISTS kubo.kubo (
    kubo_id      uuid DEFAULT gen_random_uuid() NOT NULL,
    kubo_type_id uuid NOT NULL,
    kubo_number  character varying(20) NOT NULL,
    status       kubo.kubo_status DEFAULT 'Available' NOT NULL
);

CREATE TABLE IF NOT EXISTS kubo.guest (
    guest_id        uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name      character varying(100) NOT NULL,
    last_name       character varying(100) NOT NULL,
    email           character varying(100) NOT NULL,
    phone           character varying(20) NOT NULL,
    address_line_1  character varying(200),
    city            character varying(100),
    state_province  character varying(100),
    zip_postal_code character varying(20),
    country         character varying(100),
    valid_id_type   kubo.valid_id_type NOT NULL,
    id_number       character varying(50) NOT NULL,
    created_at      timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at      timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS kubo.employee (
    employee_id   uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id       uuid NOT NULL,
    first_name    character varying(100) NOT NULL,
    last_name     character varying(100) NOT NULL,
    username      character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    status        kubo.role_status DEFAULT 'Active' NOT NULL,
    created_at    timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at    timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS kubo.reservation (
    reservation_id      uuid DEFAULT gen_random_uuid() NOT NULL,
    reference_code      character varying(50) NOT NULL,
    guest_id            uuid NOT NULL,
    employee_id         uuid NOT NULL,
    status              kubo.reservation_status DEFAULT 'Pending' NOT NULL,
    booking_source      kubo.booking_source NOT NULL,
    cancelled_at        timestamp with time zone,
    cancellation_reason character varying(255),
    reserved_at         timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS kubo.reserved_kubo (
    reservation_id           uuid NOT NULL,
    kubo_id                  uuid NOT NULL,
    check_in_date            date NOT NULL,
    check_out_date           date NOT NULL,
    scheduled_check_in_time  time without time zone,
    scheduled_check_out_time time without time zone,
    actual_check_in_datetime timestamp with time zone,
    actual_check_out_datetime timestamp with time zone,
    early_check_in_approved  boolean DEFAULT false NOT NULL,
    price_at_booking         numeric(10,2) NOT NULL,
    status                   kubo.reserved_kubo_status DEFAULT 'Reserved' NOT NULL,
    CONSTRAINT reserved_kubo_dates_check CHECK (check_out_date > check_in_date),
    CONSTRAINT reserved_kubo_price_check CHECK (price_at_booking >= 0)
);

CREATE TABLE IF NOT EXISTS kubo.payment (
    payment_id       uuid DEFAULT gen_random_uuid() NOT NULL,
    reservation_id   uuid NOT NULL,
    employee_id      uuid NOT NULL,
    payment_amount   numeric(10,2) NOT NULL,
    transaction_type kubo.transaction_type NOT NULL,
    payment_type     kubo.payment_type NOT NULL,
    payment_method   kubo.payment_method NOT NULL,
    payment_status   kubo.payment_status DEFAULT 'Pending' NOT NULL,
    payment_date     timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT payment_amount_check CHECK (payment_amount >= 0)
);

CREATE TABLE IF NOT EXISTS kubo.additional_charge (
    charge_id      uuid DEFAULT gen_random_uuid() NOT NULL,
    reservation_id uuid NOT NULL,
    employee_id    uuid NOT NULL,
    charge_type    kubo.charge_type NOT NULL,
    amount         numeric(10,2) NOT NULL,
    description    character varying(255),
    charge_date    timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT additional_charge_amount_check CHECK (amount >= 0)
);

CREATE TABLE IF NOT EXISTS kubo.audit_log (
    audit_id    uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    action      kubo.audit_action NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id   uuid NOT NULL,
    description text,
    old_values  json,
    new_values  json,
    created_at  timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ---------------------------------------------------------------------------
-- Keys and relationships (added only when a constraint of that name is absent)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT * FROM (VALUES
            ('kubo_type',     'kubo_type_pkey',               'PRIMARY KEY (kubo_type_id)'),
            ('kubo_type',     'kubo_type_name_unique',        'UNIQUE (type_name)'),
            ('kubo',          'kubo_pkey',                    'PRIMARY KEY (kubo_id)'),
            ('kubo',          'kubo_number_unique',           'UNIQUE (kubo_number)'),
            ('guest',         'guest_pkey',                   'PRIMARY KEY (guest_id)'),
            ('guest',         'guest_email_unique',           'UNIQUE (email)'),
            ('employee',      'employee_pkey',                'PRIMARY KEY (employee_id)'),
            ('employee',      'employee_username_unique',     'UNIQUE (username)'),
            ('reservation',   'reservation_pkey',             'PRIMARY KEY (reservation_id)'),
            ('reservation',   'reservation_reference_unique', 'UNIQUE (reference_code)'),
            ('reserved_kubo', 'reserved_kubo_pkey',           'PRIMARY KEY (reservation_id, kubo_id)'),
            ('payment',       'payment_pkey',                 'PRIMARY KEY (payment_id)'),
            ('additional_charge', 'additional_charge_pkey',   'PRIMARY KEY (charge_id)'),
            ('audit_log',     'audit_log_pkey',               'PRIMARY KEY (audit_id)'),
            ('kubo',          'kubo_kubo_type_fkey',          'FOREIGN KEY (kubo_type_id) REFERENCES kubo.kubo_type(kubo_type_id) ON UPDATE CASCADE ON DELETE RESTRICT'),
            ('employee',      'employee_role_fkey',           'FOREIGN KEY (role_id) REFERENCES kubo.role(role_id) ON UPDATE CASCADE ON DELETE RESTRICT'),
            ('reservation',   'reservation_guest_fkey',       'FOREIGN KEY (guest_id) REFERENCES kubo.guest(guest_id) ON UPDATE CASCADE ON DELETE RESTRICT'),
            ('reservation',   'reservation_employee_fkey',    'FOREIGN KEY (employee_id) REFERENCES kubo.employee(employee_id) ON UPDATE CASCADE ON DELETE RESTRICT'),
            ('reserved_kubo', 'reserved_kubo_reservation_fkey','FOREIGN KEY (reservation_id) REFERENCES kubo.reservation(reservation_id) ON UPDATE CASCADE ON DELETE CASCADE'),
            ('reserved_kubo', 'reserved_kubo_kubo_fkey',      'FOREIGN KEY (kubo_id) REFERENCES kubo.kubo(kubo_id) ON UPDATE CASCADE ON DELETE RESTRICT'),
            ('payment',       'payment_reservation_fkey',     'FOREIGN KEY (reservation_id) REFERENCES kubo.reservation(reservation_id) ON UPDATE CASCADE ON DELETE RESTRICT'),
            ('payment',       'payment_employee_fkey',        'FOREIGN KEY (employee_id) REFERENCES kubo.employee(employee_id) ON UPDATE CASCADE ON DELETE RESTRICT'),
            ('additional_charge', 'additional_charge_reservation_fkey', 'FOREIGN KEY (reservation_id) REFERENCES kubo.reservation(reservation_id) ON UPDATE CASCADE ON DELETE RESTRICT'),
            ('additional_charge', 'additional_charge_employee_fkey',    'FOREIGN KEY (employee_id) REFERENCES kubo.employee(employee_id) ON UPDATE CASCADE ON DELETE RESTRICT'),
            ('audit_log',     'audit_log_employee_fkey',      'FOREIGN KEY (employee_id) REFERENCES kubo.employee(employee_id) ON UPDATE CASCADE ON DELETE RESTRICT')
        ) AS v(tbl, name, ddl)
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint pc
            WHERE pc.conrelid = format('kubo.%I', c.tbl)::regclass
              AND pc.conname = c.name
        ) THEN
            EXECUTE format('ALTER TABLE kubo.%I ADD CONSTRAINT %I %s', c.tbl, c.name, c.ddl);
        END IF;
    END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- Lookup indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_kubo_kubo_type_id          ON kubo.kubo (kubo_type_id);
CREATE INDEX IF NOT EXISTS idx_kubo_type_capacity         ON kubo.kubo_type (capacity);
CREATE INDEX IF NOT EXISTS idx_guest_phone                ON kubo.guest (phone);
CREATE INDEX IF NOT EXISTS idx_employee_role_id           ON kubo.employee (role_id);
CREATE INDEX IF NOT EXISTS idx_reservation_guest_id       ON kubo.reservation (guest_id);
CREATE INDEX IF NOT EXISTS idx_reservation_employee_id    ON kubo.reservation (employee_id);
CREATE INDEX IF NOT EXISTS idx_reservation_status         ON kubo.reservation (status);
CREATE INDEX IF NOT EXISTS idx_reservation_reserved_at    ON kubo.reservation (reserved_at);
CREATE INDEX IF NOT EXISTS idx_reserved_kubo_kubo_id      ON kubo.reserved_kubo (kubo_id);
CREATE INDEX IF NOT EXISTS idx_payment_reservation_id     ON kubo.payment (reservation_id);
CREATE INDEX IF NOT EXISTS idx_payment_employee_id        ON kubo.payment (employee_id);
CREATE INDEX IF NOT EXISTS idx_payment_date               ON kubo.payment (payment_date);
CREATE INDEX IF NOT EXISTS idx_additional_charge_reservation_id ON kubo.additional_charge (reservation_id);
CREATE INDEX IF NOT EXISTS idx_additional_charge_employee_id    ON kubo.additional_charge (employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_employee_id      ON kubo.audit_log (employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at       ON kubo.audit_log (created_at);
