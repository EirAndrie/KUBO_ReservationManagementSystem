/*
  Migration: 20261110_add_day_use_and_event_bookings.sql
  ------------------------------------------------------
  Adds day-use and exclusive-event bookings (business rules BR-083 to BR-093).

  Schema
  - kubo.booking_type enum and kubo.reservation.booking_type (default
    'Overnight', so existing rows keep their behavior).
  - kubo.reservation.guest_count (party size) with declarative checks,
    including the 8-guest event minimum.
  - kubo.kubo_type.day_use_rate (nullable, >= 0); existing types get 800.
  - reserved_kubo_dates_check is relaxed to check_out_date >= check_in_date.
    The constraint cannot see booking_type, so the type-specific shape
    (Overnight/Event: later, DayUse: same date) is enforced in the routines.
  - Active catalog items for the client's fixed fees (inserted only when the
    name is missing; existing items are never overwritten).

  Routines
  - Half-open effective ranges for availability (BR-092), used by assignment
    validation, the upgrade, event creation and the availability search.
  - Create/update/confirm/cancel/assignment/check-in routines understand
    booking types; confirmation enforces the deposit and the Event carve-out.
  - fn_upgrade_day_use_to_overnight converts a day-use reservation.
  - fn_record_refund rejects Deposit refunds outside the 15-day window.
  - Day-use rate is exposed through the kubo-type routines.
  - Derived totals count a same-date assignment as one night.

  Every mutation writes its audit row through
  kubo_audit_management.write_audit_log in the same transaction (BR-071).
*/

DO $$
DECLARE
    -- Fixed client fees. Names are matched case-insensitively and existing
    -- catalog items are left untouched (A-17).
    v_catalog_seed jsonb := '[
        {"charge_type": "Other",        "name": "Entrance fee",                 "unit_price": 50,   "description": "Per person; swimming only."},
        {"charge_type": "Other",        "name": "Early/late fee",               "unit_price": 150,  "description": "Per hour of early check-in or late check-out."},
        {"charge_type": "Other",        "name": "Exclusive-use package",        "unit_price": 6000, "description": "Per night for the whole resort (exclusive events)."},
        {"charge_type": "Other",        "name": "Electricity and utilities",    "unit_price": 1000, "description": "Per night (exclusive events)."},
        {"charge_type": "ExtraPerson",  "name": "Extra person",                 "unit_price": 500,  "description": "Per person above the 8-person event minimum, per night."},
        {"charge_type": "ExtraBed",     "name": "Extra mattress",               "unit_price": 500,  "description": "Per mattress."},
        {"charge_type": "FoodAndBeverage", "name": "Extra breakfast",           "unit_price": 150,  "description": "Per breakfast."},
        {"charge_type": "Other",        "name": "Day-use to overnight upgrade", "unit_price": 700,  "description": "Per upgraded kubo, on top of the day-use fee."}
    ]'::jsonb;
    v_existing record;
BEGIN
    IF to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL
       OR to_regclass('kubo.kubo') IS NULL
       OR to_regclass('kubo.kubo_type') IS NULL
       OR to_regclass('kubo.payment') IS NULL
       OR to_regclass('kubo.additional_charge') IS NULL
       OR to_regclass('kubo.additional_charge_catalog') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_reservation_audit_json(uuid)') IS NULL
       OR to_regprocedure('kubo_additional_charges_management.fn_record_additional_charge(uuid,uuid,uuid,integer)') IS NULL
       OR to_regprocedure('kubo_additional_charges_management.fn_is_active_staff(uuid)') IS NULL
       OR to_regprocedure('kubo_additional_charges_management.fn_is_active_administrator(uuid)') IS NULL
       OR to_regprocedure('kubo_payment_management.fn_record_refund(uuid,uuid,uuid,numeric,kubo.payment_type,kubo.payment_method)') IS NULL
       OR to_regprocedure('kubo_kubo_type_management.fn_kubo_type_audit_json(uuid)') IS NULL
       OR to_regprocedure('kubo_audit_management.write_audit_log(uuid,kubo.audit_action,character varying,uuid,text,json,json)') IS NULL THEN
        RAISE NOTICE 'Day-use/event dependencies are not provisioned; skipping day-use and event bookings';
        RETURN;
    END IF;

    -------------------------------------------------------------------------
    -- Schema: booking type, guest count, day-use rate, relaxed date check
    -------------------------------------------------------------------------

    EXECUTE $ddl$
        DO $inner$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'kubo'
                  AND t.typname = 'booking_type'
            ) THEN
                CREATE TYPE kubo.booking_type AS ENUM ('Overnight', 'DayUse', 'Event');
            END IF;
        END;
        $inner$;
    $ddl$;

    EXECUTE $ddl$
        ALTER TABLE kubo.reservation
            ADD COLUMN IF NOT EXISTS booking_type kubo.booking_type NOT NULL DEFAULT 'Overnight',
            ADD COLUMN IF NOT EXISTS guest_count integer
    $ddl$;

    EXECUTE $ddl$
        DO $inner$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'reservation_guest_count_check'
                  AND conrelid = 'kubo.reservation'::regclass
            ) THEN
                ALTER TABLE kubo.reservation
                    ADD CONSTRAINT reservation_guest_count_check
                    CHECK (guest_count IS NULL OR guest_count > 0);
            END IF;

            -- BR-087: an exclusive event admits at least 8 persons.
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'reservation_event_guest_count_check'
                  AND conrelid = 'kubo.reservation'::regclass
            ) THEN
                ALTER TABLE kubo.reservation
                    ADD CONSTRAINT reservation_event_guest_count_check
                    CHECK (booking_type <> 'Event' OR guest_count >= 8);
            END IF;
        END;
        $inner$;
    $ddl$;

    -- Existing types get the client's flat 800 only when the column is first
    -- created, so re-running never overwrites a rate an Administrator changed.
    EXECUTE $ddl$
        DO $inner$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'kubo'
                  AND table_name = 'kubo_type'
                  AND column_name = 'day_use_rate'
            ) THEN
                ALTER TABLE kubo.kubo_type ADD COLUMN day_use_rate numeric(10,2);
                UPDATE kubo.kubo_type SET day_use_rate = 800;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'kubo_type_day_use_rate_check'
                  AND conrelid = 'kubo.kubo_type'::regclass
            ) THEN
                ALTER TABLE kubo.kubo_type
                    ADD CONSTRAINT kubo_type_day_use_rate_check
                    CHECK (day_use_rate IS NULL OR day_use_rate >= 0);
            END IF;
        END;
        $inner$;
    $ddl$;

    -- The original CHECK (check_out_date > check_in_date) is found by its
    -- definition so the migration does not depend on the constraint name.
    EXECUTE $ddl$
        DO $inner$
        DECLARE
            v_name name;
        BEGIN
            FOR v_name IN
                SELECT c.conname
                FROM pg_constraint c
                WHERE c.conrelid = 'kubo.reserved_kubo'::regclass
                  AND c.contype = 'c'
                  AND pg_get_constraintdef(c.oid) LIKE '%check_out_date > check_in_date%'
            LOOP
                EXECUTE format('ALTER TABLE kubo.reserved_kubo DROP CONSTRAINT %I', v_name);
            END LOOP;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'reserved_kubo_dates_check'
                  AND conrelid = 'kubo.reserved_kubo'::regclass
            ) THEN
                ALTER TABLE kubo.reserved_kubo
                    ADD CONSTRAINT reserved_kubo_dates_check
                    CHECK (check_out_date >= check_in_date);
            END IF;
        END;
        $inner$;
    $ddl$;

    -------------------------------------------------------------------------
    -- Catalog seed (idempotent, case-insensitive unique names)
    -------------------------------------------------------------------------

    INSERT INTO kubo.additional_charge_catalog (
        charge_type, name, description, unit_price, is_active
    )
    SELECT s.charge_type::kubo.charge_type, s.name, s.description, s.unit_price, true
    FROM jsonb_to_recordset(v_catalog_seed) AS s(
        charge_type text,
        name text,
        description text,
        unit_price numeric
    )
    ON CONFLICT DO NOTHING;

    -- Existing items win. Say so when one differs from the client's rule so an
    -- Administrator can correct it through the catalog API.
    FOR v_existing IN
        SELECT c.name, c.unit_price AS current_price, s.unit_price AS client_price, c.is_active
        FROM jsonb_to_recordset(v_catalog_seed) AS s(
            charge_type text,
            name text,
            description text,
            unit_price numeric
        )
        JOIN kubo.additional_charge_catalog AS c ON lower(c.name) = lower(s.name)
        WHERE c.unit_price <> s.unit_price OR NOT c.is_active
    LOOP
        RAISE NOTICE 'Catalog item "%" already exists with price % (active: %); client rule is %.',
            v_existing.name, v_existing.current_price, v_existing.is_active, v_existing.client_price;
    END LOOP;

    -------------------------------------------------------------------------
    -- Derived deposit helpers and catalog lookup
    -------------------------------------------------------------------------

    -- BR-090. Deposit amounts are constants (A-19); nothing is stored.
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_required_deposit(
            p_reservation_id uuid
        )
        RETURNS numeric
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT CASE r.booking_type
                   WHEN 'DayUse' THEN 0::numeric
                   WHEN 'Event' THEN 3500::numeric
                   ELSE 500::numeric * (
                       SELECT count(*)
                       FROM kubo.reserved_kubo AS rk
                       WHERE rk.reservation_id = r.reservation_id
                   )
               END
        FROM kubo.reservation AS r
        WHERE r.reservation_id = p_reservation_id;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_deposit_paid(
            p_reservation_id uuid
        )
        RETURNS numeric
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT COALESCE(SUM(p.payment_amount), 0)::numeric
        FROM kubo.payment AS p
        WHERE p.reservation_id = p_reservation_id
          AND p.transaction_type = 'Payment'
          AND p.payment_type = 'Deposit'
          AND p.payment_status = 'Completed';
        $function$
    $sql$;

    -- Event and upgrade charges are applied from the catalog by name (A-18).
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_get_system_catalog_id(
            p_name text
        )
        RETURNS uuid
        LANGUAGE plpgsql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_catalog_id uuid;
        BEGIN
            SELECT c.catalog_id INTO v_catalog_id
            FROM kubo.additional_charge_catalog AS c
            WHERE lower(c.name) = lower(p_name)
              AND c.is_active;

            IF v_catalog_id IS NULL THEN
                RAISE EXCEPTION 'Charge catalog item "%" is missing or inactive.', p_name
                    USING ERRCODE = '23514';
            END IF;

            RETURN v_catalog_id;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Derived totals: a same-date assignment counts as one night (BR-093)
    -------------------------------------------------------------------------

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_get_reservation_balance(
            p_reservation_id uuid
        )
        RETURNS TABLE(
            accommodation_total numeric,
            charges_total numeric,
            net_paid numeric,
            outstanding_balance numeric
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        WITH amounts AS (
            SELECT
                COALESCE((
                    SELECT SUM(
                        GREATEST(rk.check_out_date - rk.check_in_date, 1) * rk.price_at_booking
                    )
                    FROM kubo.reserved_kubo AS rk
                    WHERE rk.reservation_id = p_reservation_id
                      AND rk.status NOT IN ('Cancelled', 'NoShow')
                ), 0)::numeric AS accommodation,
                COALESCE((
                    SELECT SUM(ac.amount)
                    FROM kubo.additional_charge AS ac
                    WHERE ac.reservation_id = p_reservation_id
                ), 0)::numeric AS charges,
                COALESCE((
                    SELECT SUM(
                        CASE
                            WHEN p.transaction_type = 'Payment'
                                 AND p.payment_status IN ('Completed', 'PartiallyRefunded', 'Refunded')
                                THEN p.payment_amount
                            WHEN p.transaction_type = 'Refund'
                                 AND p.payment_status = 'Completed'
                                THEN -p.payment_amount
                            ELSE 0
                        END
                    )
                    FROM kubo.payment AS p
                    WHERE p.reservation_id = p_reservation_id
                ), 0)::numeric AS paid,
                COALESCE((
                    SELECT SUM(
                        CASE
                            WHEN p.transaction_type = 'Adjustment'
                                 AND p.payment_status = 'Completed'
                                THEN p.payment_amount
                            WHEN p.transaction_type = 'Reversal'
                                 AND p.payment_status = 'Completed'
                                THEN -p.payment_amount
                            ELSE 0
                        END
                    )
                    FROM kubo.payment AS p
                    WHERE p.reservation_id = p_reservation_id
                ), 0)::numeric AS charge_reductions
        )
        SELECT
            a.accommodation AS accommodation_total,
            a.accommodation + a.charges AS charges_total,
            a.paid AS net_paid,
            (a.accommodation + a.charges - a.paid - a.charge_reductions)
                AS outstanding_balance
        FROM amounts AS a;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_get_reserved_kubos(
            p_reservation_id uuid
        )
        RETURNS TABLE(
            reservation_id uuid,
            kubo_id uuid,
            kubo_number character varying,
            kubo_type_id uuid,
            type_name character varying,
            check_in_date text,
            check_out_date text,
            scheduled_check_in_time time without time zone,
            scheduled_check_out_time time without time zone,
            actual_check_in_datetime timestamp with time zone,
            actual_check_out_datetime timestamp with time zone,
            early_check_in_approved boolean,
            price_at_booking numeric,
            status kubo.reserved_kubo_status,
            nights integer,
            amount numeric
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            rk.reservation_id,
            rk.kubo_id,
            k.kubo_number,
            k.kubo_type_id,
            t.type_name,
            rk.check_in_date::text,
            rk.check_out_date::text,
            rk.scheduled_check_in_time,
            rk.scheduled_check_out_time,
            rk.actual_check_in_datetime,
            rk.actual_check_out_datetime,
            rk.early_check_in_approved,
            rk.price_at_booking,
            rk.status,
            GREATEST(rk.check_out_date - rk.check_in_date, 1)::integer AS nights,
            (GREATEST(rk.check_out_date - rk.check_in_date, 1) * rk.price_at_booking)::numeric AS amount
        FROM kubo.reserved_kubo AS rk
        JOIN kubo.kubo AS k ON k.kubo_id = rk.kubo_id
        JOIN kubo.kubo_type AS t ON t.kubo_type_id = k.kubo_type_id
        WHERE rk.reservation_id = p_reservation_id
        ORDER BY rk.check_in_date, k.kubo_number;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_reservation_audit_json(
            p_reservation_id uuid
        )
        RETURNS json
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT json_build_object(
            'reservation_id', r.reservation_id,
            'reference_code', r.reference_code,
            'guest_id', r.guest_id,
            'employee_id', r.employee_id,
            'status', r.status,
            'booking_source', r.booking_source,
            'booking_type', r.booking_type,
            'guest_count', r.guest_count,
            'cancelled_at', r.cancelled_at,
            'cancellation_reason', r.cancellation_reason,
            'reserved_at', r.reserved_at,
            'assignments', (
                SELECT COALESCE(
                    json_agg(
                        json_build_object(
                            'kubo_id', rk.kubo_id,
                            'check_in_date', rk.check_in_date,
                            'check_out_date', rk.check_out_date,
                            'status', rk.status,
                            'early_check_in_approved', rk.early_check_in_approved,
                            'price_at_booking', rk.price_at_booking
                        )
                        ORDER BY rk.kubo_id
                    ),
                    '[]'::json
                )
                FROM kubo.reserved_kubo AS rk
                WHERE rk.reservation_id = p_reservation_id
            )
        )
        FROM kubo.reservation AS r
        WHERE r.reservation_id = p_reservation_id;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Reservation reads: add booking type, guest count and deposit figures
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_get_reservations(
            kubo.reservation_status,
            kubo.booking_source,
            text,
            uuid,
            uuid,
            date,
            date,
            integer,
            integer
        )
    $sql$;

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_get_reservation_by_id(uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_get_reservation_by_id(
            p_reservation_id uuid
        )
        RETURNS TABLE(
            reservation_id uuid,
            reference_code character varying,
            guest_id uuid,
            guest_name text,
            employee_id uuid,
            employee_name text,
            status kubo.reservation_status,
            booking_source kubo.booking_source,
            booking_type kubo.booking_type,
            guest_count integer,
            cancelled_at timestamp with time zone,
            cancellation_reason character varying,
            reserved_at timestamp with time zone,
            accommodation_total numeric,
            charges_total numeric,
            net_paid numeric,
            outstanding_balance numeric,
            required_deposit numeric,
            deposit_paid numeric,
            assignments jsonb
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            r.reservation_id,
            r.reference_code,
            r.guest_id,
            (g.first_name || ' ' || g.last_name)::text AS guest_name,
            r.employee_id,
            (e.first_name || ' ' || e.last_name)::text AS employee_name,
            r.status,
            r.booking_source,
            r.booking_type,
            r.guest_count,
            r.cancelled_at,
            r.cancellation_reason,
            r.reserved_at,
            b.accommodation_total,
            b.charges_total,
            b.net_paid,
            b.outstanding_balance,
            kubo_reservation_management.fn_required_deposit(r.reservation_id) AS required_deposit,
            kubo_reservation_management.fn_deposit_paid(r.reservation_id) AS deposit_paid,
            COALESCE(
                (
                    SELECT jsonb_agg(to_jsonb(rk) ORDER BY rk.check_in_date, rk.kubo_number)
                    FROM kubo_reservation_management.fn_get_reserved_kubos(r.reservation_id) AS rk
                ),
                '[]'::jsonb
            ) AS assignments
        FROM kubo.reservation AS r
        JOIN kubo.guest AS g ON g.guest_id = r.guest_id
        JOIN kubo.employee AS e ON e.employee_id = r.employee_id
        CROSS JOIN LATERAL kubo_reservation_management.fn_get_reservation_balance(r.reservation_id) AS b
        WHERE r.reservation_id = p_reservation_id;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_get_reservations(
            p_status kubo.reservation_status DEFAULT NULL,
            p_booking_source kubo.booking_source DEFAULT NULL,
            p_search text DEFAULT NULL,
            p_guest_id uuid DEFAULT NULL,
            p_employee_id uuid DEFAULT NULL,
            p_check_in_date date DEFAULT NULL,
            p_check_out_date date DEFAULT NULL,
            p_limit integer DEFAULT 10,
            p_offset integer DEFAULT 0,
            p_booking_type kubo.booking_type DEFAULT NULL
        )
        RETURNS TABLE(
            reservation_id uuid,
            reference_code character varying,
            guest_id uuid,
            guest_name text,
            employee_id uuid,
            employee_name text,
            status kubo.reservation_status,
            booking_source kubo.booking_source,
            booking_type kubo.booking_type,
            guest_count integer,
            cancelled_at timestamp with time zone,
            cancellation_reason character varying,
            reserved_at timestamp with time zone,
            accommodation_total numeric,
            charges_total numeric,
            net_paid numeric,
            outstanding_balance numeric,
            required_deposit numeric,
            deposit_paid numeric,
            assignments jsonb
        )
        LANGUAGE plpgsql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_search text := NULLIF(
                regexp_replace(btrim(p_search), '([\\%_])', '\\\1', 'g'),
                ''
            );
        BEGIN
            IF p_check_in_date IS NOT NULL
               AND p_check_out_date IS NOT NULL
               AND p_check_out_date <= p_check_in_date THEN
                RAISE EXCEPTION 'Check-out filter must be later than check-in filter.'
                    USING ERRCODE = '22023';
            END IF;

            RETURN QUERY
            SELECT d.*
            FROM kubo.reservation AS r
            CROSS JOIN LATERAL kubo_reservation_management.fn_get_reservation_by_id(r.reservation_id) AS d
            WHERE (p_status IS NULL OR d.status = p_status)
              AND (p_booking_source IS NULL OR d.booking_source = p_booking_source)
              AND (p_booking_type IS NULL OR d.booking_type = p_booking_type)
              AND (p_guest_id IS NULL OR d.guest_id = p_guest_id)
              AND (p_employee_id IS NULL OR d.employee_id = p_employee_id)
              AND (
                    v_search IS NULL
                    OR d.reference_code ILIKE '%' || v_search || '%'
                    OR d.guest_name ILIKE '%' || v_search || '%'
                    OR d.employee_name ILIKE '%' || v_search || '%'
                )
              AND (
                    (p_check_in_date IS NULL AND p_check_out_date IS NULL)
                    OR EXISTS (
                        SELECT 1
                        FROM kubo.reserved_kubo AS rk
                        WHERE rk.reservation_id = r.reservation_id
                          AND (p_check_in_date IS NULL OR rk.check_in_date >= p_check_in_date)
                          AND (p_check_out_date IS NULL OR rk.check_out_date <= p_check_out_date)
                    )
                )
            ORDER BY d.reserved_at DESC, d.reservation_id
            LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100)
            OFFSET GREATEST(COALESCE(p_offset, 0), 0);
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Assignment validation with effective half-open ranges (BR-031, BR-092)
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_validate_kubo_assignment(uuid, date, date, uuid)
    $sql$;

    /**
     * Validates one kubo assignment and returns the price_at_booking snapshot.
     *
     * Date shape depends on the booking type: Overnight and Event need
     * check_out > check_in; DayUse needs check_out = check_in. The kubo row is
     * locked first, then overlap is checked against Reserved/CheckedIn
     * assignments of active reservations using the effective range
     * [check_in, GREATEST(check_out, check_in + 1)), so a same-date stay still
     * occupies its date (BR-092). Price: DayUse -> kubo_type.day_use_rate
     * (must be set), Event -> 0, Overnight -> kubo_type.price_per_night.
     */
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_validate_kubo_assignment(
            p_kubo_id uuid,
            p_check_in_date date,
            p_check_out_date date,
            p_exclude_reservation_id uuid DEFAULT NULL,
            p_booking_type kubo.booking_type DEFAULT 'Overnight'
        )
        RETURNS numeric
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_type kubo.booking_type := COALESCE(p_booking_type, 'Overnight');
            v_status kubo.kubo_status;
            v_price numeric(10,2);
            v_day_use_rate numeric(10,2);
            v_type_name varchar;
        BEGIN
            IF p_kubo_id IS NULL OR p_check_in_date IS NULL OR p_check_out_date IS NULL THEN
                RAISE EXCEPTION 'Kubo, check-in date and check-out date are required.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_type = 'DayUse' THEN
                IF p_check_out_date <> p_check_in_date THEN
                    RAISE EXCEPTION 'Day-use bookings must start and end on the same date.'
                        USING ERRCODE = '22023';
                END IF;
            ELSIF p_check_out_date <= p_check_in_date THEN
                RAISE EXCEPTION 'Check-out must be later than check-in.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_check_in_date < CURRENT_DATE THEN
                RAISE EXCEPTION 'Check-in date cannot be in the past.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.kubo AS k
            WHERE k.kubo_id = p_kubo_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Kubo does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT k.status, t.price_per_night, t.day_use_rate, t.type_name
            INTO v_status, v_price, v_day_use_rate, v_type_name
            FROM kubo.kubo AS k
            JOIN kubo.kubo_type AS t ON t.kubo_type_id = k.kubo_type_id
            WHERE k.kubo_id = p_kubo_id;

            IF v_status IN ('Maintenance', 'OutOfService', 'UnderInspection') THEN
                RAISE EXCEPTION 'Kubo is not available for booking.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_status = 'Cleaning' AND p_check_in_date <= CURRENT_DATE THEN
                RAISE EXCEPTION 'Kubo is being cleaned and is not available for a same-day check-in.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_type = 'DayUse' AND (v_day_use_rate IS NULL OR v_day_use_rate < 0) THEN
                RAISE EXCEPTION 'Kubo type "%" has no day-use rate configured.', v_type_name
                    USING ERRCODE = '23514';
            END IF;

            IF EXISTS (
                SELECT 1
                FROM kubo.reserved_kubo AS rk
                JOIN kubo.reservation AS r ON r.reservation_id = rk.reservation_id
                WHERE rk.kubo_id = p_kubo_id
                  AND (p_exclude_reservation_id IS NULL OR rk.reservation_id <> p_exclude_reservation_id)
                  AND rk.status IN ('Reserved', 'CheckedIn')
                  AND r.status IN ('Pending', 'Confirmed', 'CheckedIn')
                  AND rk.check_in_date < GREATEST(p_check_out_date, p_check_in_date + 1)
                  AND GREATEST(rk.check_out_date, rk.check_in_date + 1) > p_check_in_date
            ) THEN
                RAISE EXCEPTION 'Kubo is not available for the selected dates.'
                    USING ERRCODE = '23514';
            END IF;

            RETURN CASE v_type
                WHEN 'DayUse' THEN v_day_use_rate
                WHEN 'Event' THEN 0
                ELSE v_price
            END;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- fn_create_reservation: Overnight, DayUse and Event
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_create_reservation(uuid, uuid, kubo.booking_source, jsonb)
    $sql$;

    /**
     * Creates a Pending reservation atomically (BR-071, BR-032).
     *
     * Overnight/DayUse: p_assignments lists the kubos. DayUse defaults the
     * check-out date to the check-in date and the scheduled check-out to 17:00.
     * Event: p_assignments must be empty; the routine locks and assigns every
     * kubo for the p_event_* range at price 0, then applies the Exclusive-use
     * package, Electricity and Extra person catalog charges per night through
     * fn_record_additional_charge (snapshot semantics). Events need a Staff
     * creator, at least 8 guests, and every kubo free for the whole range.
     * Kubos are locked in kubo_id order so concurrent bookings cannot deadlock
     * on lock order.
     */
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_create_reservation(
            p_guest_id uuid,
            p_employee_id uuid,
            p_booking_source kubo.booking_source,
            p_assignments jsonb DEFAULT NULL,
            p_booking_type kubo.booking_type DEFAULT 'Overnight',
            p_guest_count integer DEFAULT NULL,
            p_event_check_in_date date DEFAULT NULL,
            p_event_check_out_date date DEFAULT NULL
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_type kubo.booking_type := COALESCE(p_booking_type, 'Overnight');
            v_reservation_id uuid;
            v_reference varchar(50);
            v_assignment record;
            v_kubo_id uuid;
            v_price numeric(10,2);
            v_check_out date;
            v_sched_out time;
            v_nights integer;
            v_count integer := 0;
        BEGIN
            IF p_guest_id IS NULL OR p_employee_id IS NULL OR p_booking_source IS NULL THEN
                RAISE EXCEPTION 'Guest, employee and booking source are required.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1 FROM kubo.guest AS g WHERE g.guest_id = p_guest_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Guest does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            PERFORM 1
            FROM kubo.employee AS e
            WHERE e.employee_id = p_employee_id
              AND e.status = 'Active';
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Creating employee does not exist or is not Active.'
                    USING ERRCODE = '23514';
            END IF;

            IF p_guest_count IS NOT NULL AND p_guest_count <= 0 THEN
                RAISE EXCEPTION 'Guest count must be greater than zero.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_type = 'Event' THEN
                IF NOT kubo_additional_charges_management.fn_is_active_staff(p_employee_id) THEN
                    RAISE EXCEPTION 'Only an active Staff member may create an Event reservation.'
                        USING ERRCODE = '42501';
                END IF;

                IF p_guest_count IS NULL OR p_guest_count < 8 THEN
                    RAISE EXCEPTION 'An exclusive event requires at least 8 guests.'
                        USING ERRCODE = '22023';
                END IF;

                IF p_assignments IS NOT NULL
                   AND jsonb_typeof(p_assignments) = 'array'
                   AND jsonb_array_length(p_assignments) > 0 THEN
                    RAISE EXCEPTION 'Event reservations assign every kubo automatically; do not supply assignments.'
                        USING ERRCODE = '22023';
                END IF;

                IF p_event_check_in_date IS NULL OR p_event_check_out_date IS NULL THEN
                    RAISE EXCEPTION 'Event check-in and check-out dates are required.'
                        USING ERRCODE = '22023';
                END IF;
            ELSE
                IF p_event_check_in_date IS NOT NULL OR p_event_check_out_date IS NOT NULL THEN
                    RAISE EXCEPTION 'Event dates apply only to Event reservations.'
                        USING ERRCODE = '22023';
                END IF;

                IF p_assignments IS NULL
                   OR jsonb_typeof(p_assignments) <> 'array'
                   OR jsonb_array_length(p_assignments) = 0 THEN
                    RAISE EXCEPTION 'At least one kubo assignment is required.'
                        USING ERRCODE = '22023';
                END IF;
            END IF;

            v_reference := kubo_reservation_management.fn_generate_reference_code();

            INSERT INTO kubo.reservation (
                reference_code,
                guest_id,
                employee_id,
                status,
                booking_source,
                booking_type,
                guest_count
            )
            VALUES (
                v_reference,
                p_guest_id,
                p_employee_id,
                'Pending',
                p_booking_source,
                v_type,
                p_guest_count
            )
            RETURNING reservation_id INTO v_reservation_id;

            IF v_type = 'Event' THEN
                -- Lock the whole resort in a stable order before validating.
                PERFORM 1 FROM kubo.kubo AS k ORDER BY k.kubo_id FOR UPDATE;

                FOR v_kubo_id IN
                    SELECT k.kubo_id FROM kubo.kubo AS k ORDER BY k.kubo_id
                LOOP
                    PERFORM kubo_reservation_management.fn_validate_kubo_assignment(
                        v_kubo_id,
                        p_event_check_in_date,
                        p_event_check_out_date,
                        NULL,
                        'Event'
                    );

                    INSERT INTO kubo.reserved_kubo (
                        reservation_id,
                        kubo_id,
                        check_in_date,
                        check_out_date,
                        price_at_booking,
                        status
                    )
                    VALUES (
                        v_reservation_id,
                        v_kubo_id,
                        p_event_check_in_date,
                        p_event_check_out_date,
                        0,
                        'Reserved'
                    );

                    UPDATE kubo.kubo AS k
                    SET status = 'Reserved'
                    WHERE k.kubo_id = v_kubo_id
                      AND k.status = 'Available';

                    v_count := v_count + 1;
                END LOOP;

                IF v_count = 0 THEN
                    RAISE EXCEPTION 'No kubos are configured, so an event cannot be booked.'
                        USING ERRCODE = '23514';
                END IF;

                v_nights := p_event_check_out_date - p_event_check_in_date;

                PERFORM kubo_additional_charges_management.fn_record_additional_charge(
                    v_reservation_id,
                    p_employee_id,
                    kubo_reservation_management.fn_get_system_catalog_id('Exclusive-use package'),
                    v_nights
                );

                PERFORM kubo_additional_charges_management.fn_record_additional_charge(
                    v_reservation_id,
                    p_employee_id,
                    kubo_reservation_management.fn_get_system_catalog_id('Electricity and utilities'),
                    v_nights
                );

                IF p_guest_count > 8 THEN
                    PERFORM kubo_additional_charges_management.fn_record_additional_charge(
                        v_reservation_id,
                        p_employee_id,
                        kubo_reservation_management.fn_get_system_catalog_id('Extra person'),
                        (p_guest_count - 8) * v_nights
                    );
                END IF;
            ELSE
                FOR v_assignment IN
                    SELECT *
                    FROM jsonb_to_recordset(p_assignments) AS x(
                        kubo_id uuid,
                        check_in_date date,
                        check_out_date date,
                        scheduled_check_in_time time,
                        scheduled_check_out_time time
                    )
                    ORDER BY x.kubo_id
                LOOP
                    v_check_out := v_assignment.check_out_date;
                    v_sched_out := v_assignment.scheduled_check_out_time;

                    IF v_type = 'DayUse' THEN
                        v_check_out := COALESCE(v_check_out, v_assignment.check_in_date);
                        v_sched_out := COALESCE(v_sched_out, TIME '17:00');
                    END IF;

                    IF v_assignment.scheduled_check_in_time IS NOT NULL
                       AND v_sched_out IS NOT NULL
                       AND v_sched_out <= v_assignment.scheduled_check_in_time THEN
                        RAISE EXCEPTION 'Scheduled check-out time must be later than scheduled check-in time.'
                            USING ERRCODE = '22023';
                    END IF;

                    v_price := kubo_reservation_management.fn_validate_kubo_assignment(
                        v_assignment.kubo_id,
                        v_assignment.check_in_date,
                        v_check_out,
                        NULL,
                        v_type
                    );

                    INSERT INTO kubo.reserved_kubo (
                        reservation_id,
                        kubo_id,
                        check_in_date,
                        check_out_date,
                        scheduled_check_in_time,
                        scheduled_check_out_time,
                        price_at_booking,
                        status
                    )
                    VALUES (
                        v_reservation_id,
                        v_assignment.kubo_id,
                        v_assignment.check_in_date,
                        v_check_out,
                        v_assignment.scheduled_check_in_time,
                        v_sched_out,
                        v_price,
                        'Reserved'
                    );

                    UPDATE kubo.kubo AS k
                    SET status = 'Reserved'
                    WHERE k.kubo_id = v_assignment.kubo_id
                      AND k.status = 'Available';

                    v_count := v_count + 1;
                END LOOP;

                IF v_count = 0 THEN
                    RAISE EXCEPTION 'At least one kubo assignment is required.'
                        USING ERRCODE = '22023';
                END IF;
            END IF;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Create'::kubo.audit_action,
                'reservation',
                v_reservation_id,
                format('Created %s reservation %s', v_type, v_reference),
                NULL,
                kubo_reservation_management.fn_reservation_audit_json(v_reservation_id)
            );

            RETURN v_reservation_id;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- fn_update_reservation: adds guest_count (not editable for Events)
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_update_reservation(uuid, uuid, kubo.booking_source, uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_update_reservation(
            p_reservation_id uuid,
            p_guest_id uuid DEFAULT NULL,
            p_booking_source kubo.booking_source DEFAULT NULL,
            p_actor_employee_id uuid DEFAULT NULL,
            p_guest_count integer DEFAULT NULL
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_status kubo.reservation_status;
            v_type kubo.booking_type;
            v_reference varchar(50);
            v_old json;
            v_new json;
        BEGIN
            IF p_guest_id IS NULL AND p_booking_source IS NULL AND p_guest_count IS NULL THEN
                RAISE EXCEPTION 'Provide at least one field to update.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_guest_count IS NOT NULL AND p_guest_count <= 0 THEN
                RAISE EXCEPTION 'Guest count must be greater than zero.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT r.status, r.reference_code, r.booking_type
            INTO v_status, v_reference, v_type
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_status NOT IN ('Pending', 'Confirmed') THEN
                RAISE EXCEPTION 'Only Pending or Confirmed reservations can be modified.'
                    USING ERRCODE = '23514';
            END IF;

            IF p_guest_count IS NOT NULL AND v_type = 'Event' THEN
                RAISE EXCEPTION 'The guest count of an Event reservation cannot be changed; cancel and rebook the event.'
                    USING ERRCODE = '23514';
            END IF;

            IF p_guest_id IS NOT NULL THEN
                PERFORM 1 FROM kubo.guest AS g WHERE g.guest_id = p_guest_id;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Guest does not exist.'
                        USING ERRCODE = 'P0002';
                END IF;
            END IF;

            v_old := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            UPDATE kubo.reservation AS r
            SET
                guest_id = COALESCE(p_guest_id, r.guest_id),
                booking_source = COALESCE(p_booking_source, r.booking_source),
                guest_count = COALESCE(p_guest_count, r.guest_count)
            WHERE r.reservation_id = p_reservation_id;

            v_new := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'reservation',
                p_reservation_id,
                format('Updated reservation %s', v_reference),
                v_old,
                v_new
            );

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- fn_confirm_reservation: deposit gate and Event approval (BR-089, BR-090)
    -------------------------------------------------------------------------

    /**
     * Confirms a Pending reservation.
     *
     * Event: only an active Administrator may confirm (the approval carve-out).
     * Overnight and Event: completed Deposit payments must cover
     * fn_required_deposit. DayUse is exempt. The acting employee is written to
     * the audit log in the same transaction.
     */
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_confirm_reservation(
            p_reservation_id uuid,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_status kubo.reservation_status;
            v_type kubo.booking_type;
            v_reference varchar(50);
            v_required numeric;
            v_paid numeric;
            v_old json;
            v_new json;
        BEGIN
            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT r.status, r.reference_code, r.booking_type
            INTO v_status, v_reference, v_type
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_status <> 'Pending' THEN
                RAISE EXCEPTION 'Only Pending reservations can be confirmed.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_type = 'Event'
               AND NOT kubo_additional_charges_management.fn_is_active_administrator(p_actor_employee_id) THEN
                RAISE EXCEPTION 'Only an active Administrator may confirm an Event reservation.'
                    USING ERRCODE = '42501';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM kubo.reserved_kubo AS rk
                WHERE rk.reservation_id = p_reservation_id
            ) THEN
                RAISE EXCEPTION 'A reservation must have at least one kubo assignment.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_type <> 'DayUse' THEN
                v_required := kubo_reservation_management.fn_required_deposit(p_reservation_id);
                v_paid := kubo_reservation_management.fn_deposit_paid(p_reservation_id);

                IF v_paid < v_required THEN
                    RAISE EXCEPTION 'Confirmation requires completed deposit payments of at least % (completed: %).',
                        v_required, v_paid
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            v_old := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            UPDATE kubo.reservation
            SET status = 'Confirmed'
            WHERE reservation_id = p_reservation_id;

            v_new := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'reservation',
                p_reservation_id,
                format('Confirmed %s reservation %s', v_type, v_reference),
                v_old,
                v_new
            );

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- fn_cancel_reservation: audit records deposit refundability (BR-091)
    -------------------------------------------------------------------------

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_cancel_reservation(
            p_reservation_id uuid,
            p_reason text,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_status kubo.reservation_status;
            v_type kubo.booking_type;
            v_reference varchar(50);
            v_reserved_at timestamptz;
            v_cancelled_at timestamptz;
            v_old json;
            v_new json;
        BEGIN
            IF p_reason IS NULL OR btrim(p_reason) = '' THEN
                RAISE EXCEPTION 'Cancellation reason is required.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT r.status, r.reference_code, r.booking_type, r.reserved_at
            INTO v_status, v_reference, v_type, v_reserved_at
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_status NOT IN ('Pending', 'Confirmed') THEN
                RAISE EXCEPTION 'Only Pending or Confirmed reservations can be cancelled.'
                    USING ERRCODE = '23514';
            END IF;

            v_old := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            UPDATE kubo.reservation
            SET status = 'Cancelled',
                cancelled_at = clock_timestamp(),
                cancellation_reason = btrim(p_reason)
            WHERE reservation_id = p_reservation_id
            RETURNING cancelled_at INTO v_cancelled_at;

            UPDATE kubo.reserved_kubo
            SET status = 'Cancelled'
            WHERE reservation_id = p_reservation_id;

            PERFORM kubo_reservation_management.fn_release_kubos(p_reservation_id);

            v_new := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Cancel'::kubo.audit_action,
                'reservation',
                p_reservation_id,
                format(
                    'Cancelled reservation %s%s',
                    v_reference,
                    CASE
                        WHEN v_type = 'DayUse' THEN ''
                        WHEN v_cancelled_at <= v_reserved_at + interval '15 days'
                            THEN '; deposit is refundable'
                        ELSE '; deposit is not refundable (cancelled more than 15 days after booking)'
                    END
                ),
                v_old,
                v_new
            );

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Assignment routines: booking-type aware
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_add_reserved_kubo(uuid, uuid, date, date, time, time, uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_add_reserved_kubo(
            p_reservation_id uuid,
            p_kubo_id uuid,
            p_check_in_date date,
            p_check_out_date date DEFAULT NULL,
            p_scheduled_check_in_time time DEFAULT NULL,
            p_scheduled_check_out_time time DEFAULT NULL,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_status kubo.reservation_status;
            v_type kubo.booking_type;
            v_price numeric(10,2);
            v_check_out date := p_check_out_date;
            v_sched_out time := p_scheduled_check_out_time;
        BEGIN
            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT r.status, r.booking_type INTO v_status, v_type
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_status NOT IN ('Pending', 'Confirmed') THEN
                RAISE EXCEPTION 'Only Pending or Confirmed reservations can be modified.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_type = 'Event' THEN
                RAISE EXCEPTION 'Event reservations cover every kubo and cannot be modified; cancel and rebook the event.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_type = 'DayUse' THEN
                v_check_out := COALESCE(v_check_out, p_check_in_date);
                v_sched_out := COALESCE(v_sched_out, TIME '17:00');
            END IF;

            IF p_scheduled_check_in_time IS NOT NULL
               AND v_sched_out IS NOT NULL
               AND v_sched_out <= p_scheduled_check_in_time THEN
                RAISE EXCEPTION 'Scheduled check-out time must be later than scheduled check-in time.'
                    USING ERRCODE = '22023';
            END IF;

            v_price := kubo_reservation_management.fn_validate_kubo_assignment(
                p_kubo_id,
                p_check_in_date,
                v_check_out,
                p_reservation_id,
                v_type
            );

            INSERT INTO kubo.reserved_kubo (
                reservation_id,
                kubo_id,
                check_in_date,
                check_out_date,
                scheduled_check_in_time,
                scheduled_check_out_time,
                price_at_booking,
                status
            )
            VALUES (
                p_reservation_id,
                p_kubo_id,
                p_check_in_date,
                v_check_out,
                p_scheduled_check_in_time,
                v_sched_out,
                v_price,
                'Reserved'
            );

            UPDATE kubo.kubo AS k
            SET status = 'Reserved'
            WHERE k.kubo_id = p_kubo_id
              AND k.status = 'Available';

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Create'::kubo.audit_action,
                'reservation',
                p_reservation_id,
                format('Assigned kubo %s to reservation', p_kubo_id),
                NULL,
                kubo_reservation_management.fn_reservation_audit_json(p_reservation_id)
            );

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_update_reserved_kubo(
            p_reservation_id uuid,
            p_kubo_id uuid,
            p_check_in_date date DEFAULT NULL,
            p_check_out_date date DEFAULT NULL,
            p_scheduled_check_in_time time DEFAULT NULL,
            p_scheduled_check_out_time time DEFAULT NULL,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_res_status kubo.reservation_status;
            v_type kubo.booking_type;
            v_current kubo.reserved_kubo%ROWTYPE;
            v_new_check_in date;
            v_new_check_out date;
            v_new_sched_in time;
            v_new_sched_out time;
            v_price numeric(10,2);
            v_dates_changed boolean;
            v_old json;
        BEGIN
            IF p_check_in_date IS NULL
               AND p_check_out_date IS NULL
               AND p_scheduled_check_in_time IS NULL
               AND p_scheduled_check_out_time IS NULL THEN
                RAISE EXCEPTION 'Provide at least one assignment field to update.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT r.status, r.booking_type INTO v_res_status, v_type
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_res_status NOT IN ('Pending', 'Confirmed') THEN
                RAISE EXCEPTION 'Only Pending or Confirmed reservations can be modified.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_type = 'Event' THEN
                RAISE EXCEPTION 'Event reservations cover every kubo and cannot be modified; cancel and rebook the event.'
                    USING ERRCODE = '23514';
            END IF;

            SELECT rk.* INTO v_current
            FROM kubo.reserved_kubo AS rk
            WHERE rk.reservation_id = p_reservation_id
              AND rk.kubo_id = p_kubo_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reserved kubo does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_current.status <> 'Reserved' THEN
                RAISE EXCEPTION 'Only Reserved assignments can be modified.'
                    USING ERRCODE = '23514';
            END IF;

            v_dates_changed := p_check_in_date IS NOT NULL OR p_check_out_date IS NOT NULL;

            IF v_type = 'DayUse' THEN
                IF p_check_in_date IS NOT NULL
                   AND p_check_out_date IS NOT NULL
                   AND p_check_in_date <> p_check_out_date THEN
                    RAISE EXCEPTION 'Day-use bookings must start and end on the same date.'
                        USING ERRCODE = '22023';
                END IF;

                v_new_check_in := COALESCE(p_check_in_date, p_check_out_date, v_current.check_in_date);
                v_new_check_out := v_new_check_in;
            ELSE
                v_new_check_in := COALESCE(p_check_in_date, v_current.check_in_date);
                v_new_check_out := COALESCE(p_check_out_date, v_current.check_out_date);
            END IF;

            v_new_sched_in := COALESCE(p_scheduled_check_in_time, v_current.scheduled_check_in_time);
            v_new_sched_out := COALESCE(p_scheduled_check_out_time, v_current.scheduled_check_out_time);

            IF v_new_sched_in IS NOT NULL
               AND v_new_sched_out IS NOT NULL
               AND v_new_sched_out <= v_new_sched_in THEN
                RAISE EXCEPTION 'Scheduled check-out time must be later than scheduled check-in time.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_dates_changed THEN
                v_price := kubo_reservation_management.fn_validate_kubo_assignment(
                    p_kubo_id,
                    v_new_check_in,
                    v_new_check_out,
                    p_reservation_id,
                    v_type
                );
            ELSE
                v_price := v_current.price_at_booking;
            END IF;

            v_old := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            UPDATE kubo.reserved_kubo AS rk
            SET
                check_in_date = v_new_check_in,
                check_out_date = v_new_check_out,
                scheduled_check_in_time = v_new_sched_in,
                scheduled_check_out_time = v_new_sched_out,
                price_at_booking = v_price
            WHERE rk.reservation_id = p_reservation_id
              AND rk.kubo_id = p_kubo_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'reservation',
                p_reservation_id,
                format('Updated assignment for kubo %s', p_kubo_id),
                v_old,
                kubo_reservation_management.fn_reservation_audit_json(p_reservation_id)
            );

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_delete_reserved_kubo(
            p_reservation_id uuid,
            p_kubo_id uuid,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_res_status kubo.reservation_status;
            v_type kubo.booking_type;
            v_assign_status kubo.reserved_kubo_status;
            v_count integer;
            v_old json;
        BEGIN
            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT r.status, r.booking_type INTO v_res_status, v_type
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_res_status NOT IN ('Pending', 'Confirmed') THEN
                RAISE EXCEPTION 'Only Pending or Confirmed reservations can be modified.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_type = 'Event' THEN
                RAISE EXCEPTION 'Event reservations cover every kubo and cannot be modified; cancel and rebook the event.'
                    USING ERRCODE = '23514';
            END IF;

            SELECT rk.status INTO v_assign_status
            FROM kubo.reserved_kubo AS rk
            WHERE rk.reservation_id = p_reservation_id
              AND rk.kubo_id = p_kubo_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reserved kubo does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_assign_status <> 'Reserved' THEN
                RAISE EXCEPTION 'Only Reserved assignments can be removed.'
                    USING ERRCODE = '23514';
            END IF;

            SELECT count(*) INTO v_count
            FROM kubo.reserved_kubo AS rk
            WHERE rk.reservation_id = p_reservation_id;

            IF v_count <= 1 THEN
                RAISE EXCEPTION 'A reservation must retain at least one kubo assignment.'
                    USING ERRCODE = '23514';
            END IF;

            v_old := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            DELETE FROM kubo.reserved_kubo AS rk
            WHERE rk.reservation_id = p_reservation_id
              AND rk.kubo_id = p_kubo_id;

            PERFORM kubo_reservation_management.fn_release_kubo(p_kubo_id);

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Delete'::kubo.audit_action,
                'reservation',
                p_reservation_id,
                format('Removed kubo %s from reservation', p_kubo_id),
                v_old,
                kubo_reservation_management.fn_reservation_audit_json(p_reservation_id)
            );

            RETURN TRUE;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- fn_check_in_reserved_kubo: a DayUse assignment checks in on its date
    -------------------------------------------------------------------------

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_check_in_reserved_kubo(
            p_reservation_id uuid,
            p_kubo_id uuid,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_res_status kubo.reservation_status;
            v_type kubo.booking_type;
            v_assignment kubo.reserved_kubo%ROWTYPE;
            v_kubo_status kubo.kubo_status;
            v_old json;
        BEGIN
            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT r.status, r.booking_type INTO v_res_status, v_type
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_res_status NOT IN ('Confirmed', 'CheckedIn') THEN
                RAISE EXCEPTION 'Check-in requires a Confirmed or CheckedIn reservation.'
                    USING ERRCODE = '23514';
            END IF;

            SELECT rk.* INTO v_assignment
            FROM kubo.reserved_kubo AS rk
            WHERE rk.reservation_id = p_reservation_id
              AND rk.kubo_id = p_kubo_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reserved kubo does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_assignment.status <> 'Reserved' THEN
                RAISE EXCEPTION 'Only Reserved assignments can be checked in.'
                    USING ERRCODE = '23514';
            END IF;

            IF CURRENT_DATE < v_assignment.check_in_date
               AND NOT v_assignment.early_check_in_approved THEN
                RAISE EXCEPTION 'Early check-in requires explicit approval.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_type = 'DayUse' THEN
                IF CURRENT_DATE > v_assignment.check_out_date THEN
                    RAISE EXCEPTION 'Day-use check-in must occur on the booked date.'
                        USING ERRCODE = '23514';
                END IF;
            ELSIF CURRENT_DATE >= v_assignment.check_out_date THEN
                RAISE EXCEPTION 'Check-in must occur before the check-out date.'
                    USING ERRCODE = '23514';
            END IF;

            PERFORM 1
            FROM kubo.kubo AS k
            WHERE k.kubo_id = p_kubo_id
            FOR UPDATE;

            SELECT k.status INTO v_kubo_status
            FROM kubo.kubo AS k
            WHERE k.kubo_id = p_kubo_id;

            IF v_kubo_status NOT IN ('Available', 'Reserved') THEN
                RAISE EXCEPTION 'Kubo is not ready for check-in. Current status: %.', v_kubo_status
                    USING ERRCODE = '23514';
            END IF;

            v_old := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            UPDATE kubo.reserved_kubo AS rk
            SET status = 'CheckedIn',
                actual_check_in_datetime = clock_timestamp()
            WHERE rk.reservation_id = p_reservation_id
              AND rk.kubo_id = p_kubo_id;

            UPDATE kubo.kubo AS k
            SET status = 'Occupied'
            WHERE k.kubo_id = p_kubo_id;

            UPDATE kubo.reservation AS r
            SET status = 'CheckedIn'
            WHERE r.reservation_id = p_reservation_id
              AND r.status = 'Confirmed';

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'reservation',
                p_reservation_id,
                format('Checked in kubo %s', p_kubo_id),
                v_old,
                kubo_reservation_management.fn_reservation_audit_json(p_reservation_id)
            );

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Day-use to overnight upgrade (BR-085)
    -------------------------------------------------------------------------

    /**
     * Converts an active DayUse reservation to Overnight.
     *
     * Every Reserved/CheckedIn assignment is extended to
     * check_in_date + p_nights after an availability check that excludes the
     * reservation itself. price_at_booking keeps its day-use snapshot, the
     * scheduled check-out is cleared, and the "Day-use to overnight upgrade"
     * catalog item is applied once per upgraded kubo through
     * fn_record_additional_charge. Staff-only; one transaction; audited.
     */
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_upgrade_day_use_to_overnight(
            p_reservation_id uuid,
            p_nights integer,
            p_actor_employee_id uuid
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_status kubo.reservation_status;
            v_type kubo.booking_type;
            v_reference varchar(50);
            v_assignment kubo.reserved_kubo%ROWTYPE;
            v_upgraded integer := 0;
            v_old json;
        BEGIN
            IF NOT kubo_additional_charges_management.fn_is_active_staff(p_actor_employee_id) THEN
                RAISE EXCEPTION 'Only an active Staff member may upgrade a day-use reservation.'
                    USING ERRCODE = '42501';
            END IF;

            IF p_nights IS NULL OR p_nights < 1 THEN
                RAISE EXCEPTION 'Nights must be a positive whole number.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT r.status, r.booking_type, r.reference_code
            INTO v_status, v_type, v_reference
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_type <> 'DayUse' THEN
                RAISE EXCEPTION 'Only DayUse reservations can be upgraded to overnight.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_status NOT IN ('Pending', 'Confirmed', 'CheckedIn') THEN
                RAISE EXCEPTION 'Only active reservations can be upgraded.'
                    USING ERRCODE = '23514';
            END IF;

            IF EXISTS (
                SELECT 1
                FROM kubo.reserved_kubo AS rk
                WHERE rk.reservation_id = p_reservation_id
                  AND rk.status = 'CheckedOut'
            ) THEN
                RAISE EXCEPTION 'A day-use assignment that was already checked out cannot be upgraded.'
                    USING ERRCODE = '23514';
            END IF;

            v_old := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            FOR v_assignment IN
                SELECT rk.*
                FROM kubo.reserved_kubo AS rk
                WHERE rk.reservation_id = p_reservation_id
                  AND rk.status IN ('Reserved', 'CheckedIn')
                ORDER BY rk.kubo_id
                FOR UPDATE
            LOOP
                PERFORM kubo_reservation_management.fn_validate_kubo_assignment(
                    v_assignment.kubo_id,
                    v_assignment.check_in_date,
                    v_assignment.check_in_date + p_nights,
                    p_reservation_id,
                    'Overnight'
                );

                UPDATE kubo.reserved_kubo AS rk
                SET check_out_date = rk.check_in_date + p_nights,
                    scheduled_check_out_time = NULL
                WHERE rk.reservation_id = p_reservation_id
                  AND rk.kubo_id = v_assignment.kubo_id;

                v_upgraded := v_upgraded + 1;
            END LOOP;

            IF v_upgraded = 0 THEN
                RAISE EXCEPTION 'The reservation has no active assignment to upgrade.'
                    USING ERRCODE = '23514';
            END IF;

            UPDATE kubo.reservation AS r
            SET booking_type = 'Overnight'
            WHERE r.reservation_id = p_reservation_id;

            PERFORM kubo_additional_charges_management.fn_record_additional_charge(
                p_reservation_id,
                p_actor_employee_id,
                kubo_reservation_management.fn_get_system_catalog_id('Day-use to overnight upgrade'),
                v_upgraded
            );

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'reservation',
                p_reservation_id,
                format('Upgraded day-use reservation %s to Overnight for %s night(s)', v_reference, p_nights),
                v_old,
                kubo_reservation_management.fn_reservation_audit_json(p_reservation_id)
            );

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- fn_record_refund: Deposit refunds only inside the 15-day window (BR-091)
    -------------------------------------------------------------------------

    /**
     * Records a Staff refund against a completed payment (BR-054).
     *
     * Added rule (BR-091): when the original payment was recorded as a
     * Deposit, the reservation must be Cancelled and cancelled_at must be no
     * later than reserved_at + 15 days. The check reads the original payment
     * and its reservation directly. The refund-to-payment link is still the
     * audit description "against payment <id>", which is also how cumulative
     * refunds of one original are totalled below.
     */
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_record_refund(
            p_reservation_id uuid,
            p_employee_id uuid,
            p_original_payment_id uuid,
            p_payment_amount numeric,
            p_payment_type kubo.payment_type,
            p_payment_method kubo.payment_method
        )
        RETURNS TABLE(
            payment_id uuid,
            reservation_id uuid,
            reference_code character varying,
            employee_id uuid,
            recorded_by text,
            payment_amount numeric,
            transaction_type kubo.transaction_type,
            payment_type kubo.payment_type,
            payment_method kubo.payment_method,
            payment_status kubo.payment_status,
            payment_date timestamp with time zone
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_original kubo.payment%ROWTYPE;
            v_res_status kubo.reservation_status;
            v_reserved_at timestamptz;
            v_cancelled_at timestamptz;
            v_net_paid numeric;
            v_refund_id uuid;
            v_prior_refunded numeric;
            v_refunded_total numeric;
            v_new_original_status kubo.payment_status;
        BEGIN
            IF NOT kubo_payment_management.fn_is_active_staff(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Staff member may record refunds.'
                    USING ERRCODE = '42501';
            END IF;

            IF p_payment_amount IS NULL OR p_payment_amount <= 0
               OR p_payment_amount <> round(p_payment_amount, 2) THEN
                RAISE EXCEPTION 'Refund amount must be positive with at most two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_payment_type IS NULL OR p_payment_method IS NULL THEN
                RAISE EXCEPTION 'Payment type and method are required.'
                    USING ERRCODE = '22023';
            END IF;

            SELECT * INTO v_original
            FROM kubo.payment AS p
            WHERE p.payment_id = p_original_payment_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Original payment does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_original.reservation_id <> p_reservation_id THEN
                RAISE EXCEPTION 'Original payment does not belong to this reservation.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_original.transaction_type <> 'Payment'
               OR v_original.payment_status NOT IN ('Completed', 'PartiallyRefunded') THEN
                RAISE EXCEPTION 'Refunds require a completed original payment.'
                    USING ERRCODE = '23514';
            END IF;

            SELECT r.status, r.reserved_at, r.cancelled_at
            INTO v_res_status, v_reserved_at, v_cancelled_at
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR SHARE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_original.payment_type = 'Deposit' THEN
                IF v_res_status <> 'Cancelled' OR v_cancelled_at IS NULL THEN
                    RAISE EXCEPTION 'A deposit is refundable only when the reservation is cancelled within 15 days of booking.'
                        USING ERRCODE = '23514';
                END IF;

                IF v_cancelled_at > v_reserved_at + interval '15 days' THEN
                    RAISE EXCEPTION 'The deposit is not refundable: the reservation was cancelled more than 15 days after booking.'
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            SELECT b.net_paid INTO v_net_paid
            FROM kubo_reservation_management.fn_get_reservation_balance(p_reservation_id) AS b;

            IF p_payment_amount > v_net_paid THEN
                RAISE EXCEPTION 'Refund exceeds the net amount paid of %.', v_net_paid
                    USING ERRCODE = '23514';
            END IF;

            INSERT INTO kubo.payment AS p (
                reservation_id,
                employee_id,
                payment_amount,
                transaction_type,
                payment_type,
                payment_method,
                payment_status
            )
            VALUES (
                p_reservation_id,
                p_employee_id,
                p_payment_amount,
                'Refund',
                p_payment_type,
                p_payment_method,
                'Completed'
            )
            RETURNING p.payment_id INTO v_refund_id;

            -- The DDL has no original_payment_id column. Refund linkage is
            -- recorded in the audit description, so aggregate prior refunds
            -- from there to decide whether the original is fully refunded.
            SELECT COALESCE(SUM(r.payment_amount), 0)
            INTO v_prior_refunded
            FROM kubo.audit_log AS a
            JOIN kubo.payment AS r ON r.payment_id = a.entity_id
            WHERE a.entity_type = 'payment'
              AND a.action = 'Create'
              AND r.transaction_type = 'Refund'
              AND r.reservation_id = p_reservation_id
              AND a.description LIKE '%against payment ' || p_original_payment_id::text;

            v_refunded_total := v_prior_refunded + p_payment_amount;

            IF v_refunded_total >= v_original.payment_amount THEN
                v_new_original_status := 'Refunded';
            ELSE
                v_new_original_status := 'PartiallyRefunded';
            END IF;

            UPDATE kubo.payment AS p
            SET payment_status = v_new_original_status
            WHERE p.payment_id = p_original_payment_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Create'::kubo.audit_action,
                'payment',
                v_refund_id,
                format('Recorded refund of %s against payment %s', p_payment_amount, p_original_payment_id),
                NULL,
                (SELECT to_json(p) FROM kubo.payment AS p WHERE p.payment_id = v_refund_id)
            );

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Update'::kubo.audit_action,
                'payment',
                p_original_payment_id,
                format('Original payment status changed to %s after refund', v_new_original_status),
                to_json(v_original),
                (SELECT to_json(p) FROM kubo.payment AS p WHERE p.payment_id = p_original_payment_id)
            );

            RETURN QUERY
            SELECT * FROM kubo_payment_management.fn_get_payment_by_id(v_refund_id);
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Kubo type: expose and manage day_use_rate (BR-084)
    -------------------------------------------------------------------------

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_kubo_type_management.fn_kubo_type_audit_json(
            p_kubo_type_id uuid
        )
        RETURNS json
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT json_build_object(
            'kubo_type_id', kt.kubo_type_id,
            'type_name', kt.type_name,
            'capacity', kt.capacity,
            'price_per_night', kt.price_per_night,
            'day_use_rate', kt.day_use_rate,
            'description', kt.description
        )
        FROM kubo.kubo_type AS kt
        WHERE kt.kubo_type_id = p_kubo_type_id;
        $function$
    $sql$;

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_kubo_type_management.fn_get_kubo_type_by_id(uuid)
    $sql$;

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_kubo_type_management.fn_get_kubo_types(text, integer, integer, integer, integer)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_kubo_type_management.fn_get_kubo_type_by_id(
            p_kubo_type_id uuid
        )
        RETURNS TABLE(
            kubo_type_id uuid,
            type_name character varying,
            capacity integer,
            price_per_night numeric,
            day_use_rate numeric,
            description character varying
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            kt.kubo_type_id,
            kt.type_name,
            kt.capacity,
            kt.price_per_night,
            kt.day_use_rate,
            kt.description
        FROM kubo.kubo_type AS kt
        WHERE kt.kubo_type_id = p_kubo_type_id;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_kubo_type_management.fn_get_kubo_types(
            p_search text DEFAULT NULL,
            p_min_capacity integer DEFAULT NULL,
            p_max_capacity integer DEFAULT NULL,
            p_limit integer DEFAULT 10,
            p_offset integer DEFAULT 0
        )
        RETURNS TABLE(
            kubo_type_id uuid,
            type_name character varying,
            capacity integer,
            price_per_night numeric,
            day_use_rate numeric,
            description character varying
        )
        LANGUAGE plpgsql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_search text := NULLIF(
                regexp_replace(btrim(p_search), '([\\%_])', '\\\1', 'g'),
                ''
            );
        BEGIN
            IF p_min_capacity IS NOT NULL AND p_min_capacity < 0 THEN
                RAISE EXCEPTION 'Minimum capacity cannot be negative.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_max_capacity IS NOT NULL AND p_max_capacity < 0 THEN
                RAISE EXCEPTION 'Maximum capacity cannot be negative.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_min_capacity IS NOT NULL
               AND p_max_capacity IS NOT NULL
               AND p_min_capacity > p_max_capacity THEN
                RAISE EXCEPTION 'Minimum capacity cannot exceed maximum capacity.'
                    USING ERRCODE = '22023';
            END IF;

            RETURN QUERY
            SELECT
                kt.kubo_type_id,
                kt.type_name,
                kt.capacity,
                kt.price_per_night,
                kt.day_use_rate,
                kt.description
            FROM kubo.kubo_type AS kt
            WHERE (
                    v_search IS NULL
                    OR kt.type_name ILIKE '%' || v_search || '%'
                    OR kt.description ILIKE '%' || v_search || '%'
                )
              AND (p_min_capacity IS NULL OR kt.capacity >= p_min_capacity)
              AND (p_max_capacity IS NULL OR kt.capacity <= p_max_capacity)
            ORDER BY kt.type_name, kt.kubo_type_id
            LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100)
            OFFSET GREATEST(COALESCE(p_offset, 0), 0);
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_kubo_type_management.fn_create_kubo_type(character varying, integer, numeric, character varying, uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_kubo_type_management.fn_create_kubo_type(
            p_type_name character varying,
            p_capacity integer,
            p_price_per_night numeric,
            p_description character varying DEFAULT NULL,
            p_actor_employee_id uuid DEFAULT NULL,
            p_day_use_rate numeric DEFAULT NULL
        )
        RETURNS TABLE(
            kubo_type_id uuid,
            type_name character varying,
            capacity integer,
            price_per_night numeric,
            day_use_rate numeric,
            description character varying
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_name text := NULLIF(btrim(p_type_name), '');
            v_desc text := NULLIF(btrim(p_description), '');
            v_type kubo.kubo_type%ROWTYPE;
        BEGIN
            IF v_name IS NULL OR length(v_name) > 100 THEN
                RAISE EXCEPTION 'Kubo type name must be between 1 and 100 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_capacity IS NULL OR p_capacity <= 0 THEN
                RAISE EXCEPTION 'Capacity must be greater than zero.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_price_per_night IS NULL OR p_price_per_night < 0 THEN
                RAISE EXCEPTION 'Price per night cannot be negative.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_price_per_night <> round(p_price_per_night, 2) THEN
                RAISE EXCEPTION 'Price per night cannot have more than two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_day_use_rate IS NOT NULL
               AND (p_day_use_rate < 0 OR p_day_use_rate <> round(p_day_use_rate, 2)) THEN
                RAISE EXCEPTION 'Day-use rate must be non-negative with at most two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_desc IS NOT NULL AND length(v_desc) > 255 THEN
                RAISE EXCEPTION 'Kubo type description cannot exceed 255 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF EXISTS (
                SELECT 1
                FROM kubo.kubo_type AS kt
                WHERE lower(kt.type_name) = lower(v_name)
            ) THEN
                RAISE EXCEPTION 'Kubo type name already exists.'
                    USING ERRCODE = '23505';
            END IF;

            INSERT INTO kubo.kubo_type (
                type_name,
                capacity,
                price_per_night,
                day_use_rate,
                description
            )
            VALUES (
                v_name,
                p_capacity,
                p_price_per_night,
                p_day_use_rate,
                v_desc
            )
            RETURNING * INTO v_type;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Create'::kubo.audit_action,
                'kubo_type',
                v_type.kubo_type_id,
                format('Created kubo type %s', v_name),
                NULL,
                kubo_kubo_type_management.fn_kubo_type_audit_json(v_type.kubo_type_id)
            );

            RETURN QUERY
            SELECT
                kt.kubo_type_id,
                kt.type_name,
                kt.capacity,
                kt.price_per_night,
                kt.day_use_rate,
                kt.description
            FROM kubo.kubo_type AS kt
            WHERE kt.kubo_type_id = v_type.kubo_type_id;
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'Kubo type name already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_kubo_type_management.fn_update_kubo_type(uuid, character varying, integer, numeric, character varying, uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_kubo_type_management.fn_update_kubo_type(
            p_kubo_type_id uuid,
            p_type_name character varying DEFAULT NULL,
            p_capacity integer DEFAULT NULL,
            p_price_per_night numeric DEFAULT NULL,
            p_description character varying DEFAULT NULL,
            p_actor_employee_id uuid DEFAULT NULL,
            p_day_use_rate numeric DEFAULT NULL
        )
        RETURNS TABLE(
            kubo_type_id uuid,
            type_name character varying,
            capacity integer,
            price_per_night numeric,
            day_use_rate numeric,
            description character varying
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_name text := NULLIF(btrim(p_type_name), '');
            v_desc text := NULLIF(btrim(p_description), '');
            v_type kubo.kubo_type%ROWTYPE;
            v_old json;
        BEGIN
            IF p_type_name IS NULL
               AND p_capacity IS NULL
               AND p_price_per_night IS NULL
               AND p_day_use_rate IS NULL
               AND p_description IS NULL THEN
                RAISE EXCEPTION 'Provide at least one field to update.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_type_name IS NOT NULL
               AND (v_name IS NULL OR length(v_name) > 100) THEN
                RAISE EXCEPTION 'Kubo type name must be between 1 and 100 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_capacity IS NOT NULL AND p_capacity <= 0 THEN
                RAISE EXCEPTION 'Capacity must be greater than zero.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_price_per_night IS NOT NULL AND p_price_per_night < 0 THEN
                RAISE EXCEPTION 'Price per night cannot be negative.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_price_per_night IS NOT NULL
               AND p_price_per_night <> round(p_price_per_night, 2) THEN
                RAISE EXCEPTION 'Price per night cannot have more than two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_day_use_rate IS NOT NULL
               AND (p_day_use_rate < 0 OR p_day_use_rate <> round(p_day_use_rate, 2)) THEN
                RAISE EXCEPTION 'Day-use rate must be non-negative with at most two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_description IS NOT NULL
               AND v_desc IS NOT NULL
               AND length(v_desc) > 255 THEN
                RAISE EXCEPTION 'Kubo type description cannot exceed 255 characters.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.kubo_type AS kt
            WHERE kt.kubo_type_id = p_kubo_type_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Kubo type does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_name IS NOT NULL AND EXISTS (
                SELECT 1
                FROM kubo.kubo_type AS kt
                WHERE lower(kt.type_name) = lower(v_name)
                  AND kt.kubo_type_id <> p_kubo_type_id
            ) THEN
                RAISE EXCEPTION 'Kubo type name already exists.'
                    USING ERRCODE = '23505';
            END IF;

            v_old := kubo_kubo_type_management.fn_kubo_type_audit_json(p_kubo_type_id);

            UPDATE kubo.kubo_type AS kt
            SET
                type_name = COALESCE(v_name, kt.type_name),
                capacity = COALESCE(p_capacity, kt.capacity),
                price_per_night = COALESCE(p_price_per_night, kt.price_per_night),
                day_use_rate = COALESCE(p_day_use_rate, kt.day_use_rate),
                description = CASE
                    WHEN p_description IS NULL THEN kt.description
                    ELSE v_desc
                END
            WHERE kt.kubo_type_id = p_kubo_type_id
            RETURNING * INTO v_type;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'kubo_type',
                p_kubo_type_id,
                format('Updated kubo type %s', v_type.type_name),
                v_old,
                kubo_kubo_type_management.fn_kubo_type_audit_json(p_kubo_type_id)
            );

            RETURN QUERY
            SELECT
                kt.kubo_type_id,
                kt.type_name,
                kt.capacity,
                kt.price_per_night,
                kt.day_use_rate,
                kt.description
            FROM kubo.kubo_type AS kt
            WHERE kt.kubo_type_id = v_type.kubo_type_id;
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'Kubo type name already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Availability search: effective ranges; check-in = check-out is day use
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_management.fn_search_available_kubos(date, date, uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_management.fn_search_available_kubos(
            p_check_in date,
            p_check_out date,
            p_kubo_type_id uuid DEFAULT NULL
        )
        RETURNS TABLE(
            kubo_id uuid,
            kubo_number character varying,
            kubo_type_id uuid,
            type_name character varying,
            capacity integer,
            price_per_night numeric,
            day_use_rate numeric,
            status kubo.kubo_status
        )
        LANGUAGE plpgsql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        BEGIN
            IF p_check_in IS NULL OR p_check_out IS NULL
               OR p_check_out < p_check_in THEN
                RAISE EXCEPTION 'Check-out cannot be earlier than check-in.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_check_in < CURRENT_DATE THEN
                RAISE EXCEPTION 'Check-in date cannot be in the past.'
                    USING ERRCODE = '22023';
            END IF;

            -- p_check_out = p_check_in asks for a day-use date; its effective
            -- range is [p_check_in, p_check_in + 1).
            RETURN QUERY
            SELECT
                k.kubo_id,
                k.kubo_number,
                k.kubo_type_id,
                t.type_name,
                t.capacity,
                t.price_per_night,
                t.day_use_rate,
                k.status
            FROM kubo.kubo AS k
            JOIN kubo.kubo_type AS t ON t.kubo_type_id = k.kubo_type_id
            WHERE (
                    k.status IN ('Available', 'Reserved', 'Occupied')
                    OR (k.status = 'Cleaning' AND p_check_in > CURRENT_DATE)
                )
              AND (p_kubo_type_id IS NULL OR k.kubo_type_id = p_kubo_type_id)
              AND NOT EXISTS (
                    SELECT 1
                    FROM kubo.reserved_kubo AS rk
                    JOIN kubo.reservation AS r ON r.reservation_id = rk.reservation_id
                    WHERE rk.kubo_id = k.kubo_id
                      AND (
                            (rk.status IN ('Reserved', 'CheckedIn')
                             AND r.status IN ('Pending', 'Confirmed', 'CheckedIn')
                             AND rk.check_in_date < GREATEST(p_check_out, p_check_in + 1)
                             AND GREATEST(rk.check_out_date, rk.check_in_date + 1) > p_check_in)
                            OR (rk.status = 'CheckedIn'
                                AND p_check_in <= CURRENT_DATE)
                      )
              )
            ORDER BY k.kubo_number, k.kubo_id;
        END;
        $function$
    $sql$;
END $$;
