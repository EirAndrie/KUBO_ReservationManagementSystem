/*
  Migration: 20261101_harden_reservation_management.sql
  -----------------------------------------------------
  Adds the reservation and reserved-kubo routines required by the business
  rules.

  Included:
  - Server-generated unique reference codes.
  - Atomic reservation creation with at least one assignment.
  - Kubo locking and overlap revalidation.
  - price_at_booking snapshots from kubo_type.price_per_night.
  - Derived accommodation, charges, net paid and outstanding balance.
  - Dedicated confirm, cancel, no-show, check-in and check-out operations.
  - Per-assignment check-in/out with reservation status aggregation.
  - Reference-safe assignment removal and repair-only reservation deletion.
  - Zero-balance check-out enforcement.

  Audit writes are intentionally deferred until authentication provides a
  trusted acting employee.
*/

DO $$
BEGIN
    IF to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL
       OR to_regclass('kubo.kubo') IS NULL
       OR to_regclass('kubo.kubo_type') IS NULL
       OR to_regclass('kubo.guest') IS NULL
       OR to_regclass('kubo.employee') IS NULL
       OR to_regclass('kubo.payment') IS NULL
       OR to_regclass('kubo.additional_charge') IS NULL THEN
        RAISE NOTICE 'Reservation dependencies are not provisioned; skipping reservation hardening';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE SCHEMA IF NOT EXISTS kubo_reservation_management
    $sql$;

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
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_get_reserved_kubo(uuid, uuid)
    $sql$;

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_get_reserved_kubos(uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_generate_reference_code()
        RETURNS character varying
        LANGUAGE plpgsql
        VOLATILE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_code varchar(50);
            v_attempt integer := 0;
        BEGIN
            LOOP
                v_attempt := v_attempt + 1;
                v_code := 'RES-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-'
                    || lpad((floor(random() * 10000))::integer::text, 4, '0');

                IF NOT EXISTS (
                    SELECT 1
                    FROM kubo.reservation AS r
                    WHERE r.reference_code = v_code
                ) THEN
                    RETURN v_code;
                END IF;

                IF v_attempt >= 20 THEN
                    RAISE EXCEPTION 'Unable to generate a unique reservation reference code.'
                        USING ERRCODE = '23505';
                END IF;
            END LOOP;
        END;
        $function$
    $sql$;

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
                    SELECT SUM((rk.check_out_date - rk.check_in_date) * rk.price_at_booking)
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
                                 AND p.payment_status = 'Completed'
                                THEN p.payment_amount
                            WHEN p.transaction_type = 'Refund'
                                 AND p.payment_status = 'Completed'
                                THEN -p.payment_amount
                            ELSE 0
                        END
                    )
                    FROM kubo.payment AS p
                    WHERE p.reservation_id = p_reservation_id
                ), 0)::numeric AS paid
        )
        SELECT
            a.accommodation AS accommodation_total,
            a.accommodation + a.charges AS charges_total,
            a.paid AS net_paid,
            (a.accommodation + a.charges - a.paid) AS outstanding_balance
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
            (rk.check_out_date - rk.check_in_date)::integer AS nights,
            ((rk.check_out_date - rk.check_in_date) * rk.price_at_booking)::numeric AS amount
        FROM kubo.reserved_kubo AS rk
        JOIN kubo.kubo AS k ON k.kubo_id = rk.kubo_id
        JOIN kubo.kubo_type AS t ON t.kubo_type_id = k.kubo_type_id
        WHERE rk.reservation_id = p_reservation_id
        ORDER BY rk.check_in_date, k.kubo_number;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_get_reserved_kubo(
            p_reservation_id uuid,
            p_kubo_id uuid
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
        SELECT *
        FROM kubo_reservation_management.fn_get_reserved_kubos(p_reservation_id) AS rk
        WHERE rk.kubo_id = p_kubo_id;
        $function$
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
            cancelled_at timestamp with time zone,
            cancellation_reason character varying,
            reserved_at timestamp with time zone,
            accommodation_total numeric,
            charges_total numeric,
            net_paid numeric,
            outstanding_balance numeric,
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
            r.cancelled_at,
            r.cancellation_reason,
            r.reserved_at,
            b.accommodation_total,
            b.charges_total,
            b.net_paid,
            b.outstanding_balance,
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
            p_offset integer DEFAULT 0
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
            cancelled_at timestamp with time zone,
            cancellation_reason character varying,
            reserved_at timestamp with time zone,
            accommodation_total numeric,
            charges_total numeric,
            net_paid numeric,
            outstanding_balance numeric,
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

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_validate_kubo_assignment(
            p_kubo_id uuid,
            p_check_in_date date,
            p_check_out_date date,
            p_exclude_reservation_id uuid DEFAULT NULL
        )
        RETURNS numeric
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_status kubo.kubo_status;
            v_price numeric(10,2);
        BEGIN
            IF p_kubo_id IS NULL OR p_check_in_date IS NULL OR p_check_out_date IS NULL THEN
                RAISE EXCEPTION 'Kubo, check-in date and check-out date are required.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_check_out_date <= p_check_in_date THEN
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

            SELECT k.status, t.price_per_night
            INTO v_status, v_price
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

            IF EXISTS (
                SELECT 1
                FROM kubo.reserved_kubo AS rk
                JOIN kubo.reservation AS r ON r.reservation_id = rk.reservation_id
                WHERE rk.kubo_id = p_kubo_id
                  AND (p_exclude_reservation_id IS NULL OR rk.reservation_id <> p_exclude_reservation_id)
                  AND rk.status IN ('Reserved', 'CheckedIn')
                  AND r.status IN ('Pending', 'Confirmed', 'CheckedIn')
                  AND rk.check_in_date < p_check_out_date
                  AND rk.check_out_date > p_check_in_date
            ) THEN
                RAISE EXCEPTION 'Kubo is not available for the selected dates.'
                    USING ERRCODE = '23514';
            END IF;

            RETURN v_price;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_create_reservation(
            p_guest_id uuid,
            p_employee_id uuid,
            p_booking_source kubo.booking_source,
            p_assignments jsonb
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_reservation_id uuid;
            v_reference varchar(50);
            v_assignment record;
            v_price numeric(10,2);
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

            IF p_assignments IS NULL
               OR jsonb_typeof(p_assignments) <> 'array'
               OR jsonb_array_length(p_assignments) = 0 THEN
                RAISE EXCEPTION 'At least one kubo assignment is required.'
                    USING ERRCODE = '22023';
            END IF;

            v_reference := kubo_reservation_management.fn_generate_reference_code();

            INSERT INTO kubo.reservation (
                reference_code,
                guest_id,
                employee_id,
                status,
                booking_source
            )
            VALUES (
                v_reference,
                p_guest_id,
                p_employee_id,
                'Pending',
                p_booking_source
            )
            RETURNING reservation_id INTO v_reservation_id;

            FOR v_assignment IN
                SELECT *
                FROM jsonb_to_recordset(p_assignments) AS x(
                    kubo_id uuid,
                    check_in_date date,
                    check_out_date date,
                    scheduled_check_in_time time,
                    scheduled_check_out_time time
                )
            LOOP
                IF v_assignment.scheduled_check_in_time IS NOT NULL
                   AND v_assignment.scheduled_check_out_time IS NOT NULL
                   AND v_assignment.scheduled_check_out_time <= v_assignment.scheduled_check_in_time THEN
                    RAISE EXCEPTION 'Scheduled check-out time must be later than scheduled check-in time.'
                        USING ERRCODE = '22023';
                END IF;

                v_price := kubo_reservation_management.fn_validate_kubo_assignment(
                    v_assignment.kubo_id,
                    v_assignment.check_in_date,
                    v_assignment.check_out_date,
                    NULL
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
                    v_assignment.check_out_date,
                    v_assignment.scheduled_check_in_time,
                    v_assignment.scheduled_check_out_time,
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

            RETURN v_reservation_id;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_update_reservation(
            p_reservation_id uuid,
            p_guest_id uuid DEFAULT NULL,
            p_booking_source kubo.booking_source DEFAULT NULL
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_status kubo.reservation_status;
        BEGIN
            IF p_guest_id IS NULL AND p_booking_source IS NULL THEN
                RAISE EXCEPTION 'Provide at least one field to update.'
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

            SELECT r.status INTO v_status
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_status NOT IN ('Pending', 'Confirmed') THEN
                RAISE EXCEPTION 'Only Pending or Confirmed reservations can be modified.'
                    USING ERRCODE = '23514';
            END IF;

            IF p_guest_id IS NOT NULL THEN
                PERFORM 1 FROM kubo.guest AS g WHERE g.guest_id = p_guest_id;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Guest does not exist.'
                        USING ERRCODE = 'P0002';
                END IF;
            END IF;

            UPDATE kubo.reservation AS r
            SET
                guest_id = COALESCE(p_guest_id, r.guest_id),
                booking_source = COALESCE(p_booking_source, r.booking_source)
            WHERE r.reservation_id = p_reservation_id;

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_confirm_reservation(
            p_reservation_id uuid
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_status kubo.reservation_status;
        BEGIN
            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT r.status INTO v_status
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_status <> 'Pending' THEN
                RAISE EXCEPTION 'Only Pending reservations can be confirmed.'
                    USING ERRCODE = '23514';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM kubo.reserved_kubo AS rk
                WHERE rk.reservation_id = p_reservation_id
            ) THEN
                RAISE EXCEPTION 'A reservation must have at least one kubo assignment.'
                    USING ERRCODE = '23514';
            END IF;

            UPDATE kubo.reservation
            SET status = 'Confirmed'
            WHERE reservation_id = p_reservation_id;

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_release_kubo(
            p_kubo_id uuid
        )
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        BEGIN
            UPDATE kubo.kubo AS k
            SET status = 'Available'
            WHERE k.kubo_id = p_kubo_id
              AND k.status IN ('Reserved', 'Occupied', 'Cleaning')
              AND NOT EXISTS (
                    SELECT 1
                    FROM kubo.reserved_kubo AS rk
                    JOIN kubo.reservation AS r ON r.reservation_id = rk.reservation_id
                    WHERE rk.kubo_id = p_kubo_id
                      AND rk.status IN ('Reserved', 'CheckedIn')
                      AND r.status IN ('Pending', 'Confirmed', 'CheckedIn')
              );
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_release_kubos(
            p_reservation_id uuid
        )
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        BEGIN
            UPDATE kubo.kubo AS k
            SET status = 'Available'
            WHERE k.kubo_id IN (
                    SELECT rk.kubo_id
                    FROM kubo.reserved_kubo AS rk
                    WHERE rk.reservation_id = p_reservation_id
                )
              AND k.status IN ('Reserved', 'Occupied', 'Cleaning')
              AND NOT EXISTS (
                    SELECT 1
                    FROM kubo.reserved_kubo AS rk2
                    JOIN kubo.reservation AS r2 ON r2.reservation_id = rk2.reservation_id
                    WHERE rk2.kubo_id = k.kubo_id
                      AND rk2.status IN ('Reserved', 'CheckedIn')
                      AND r2.status IN ('Pending', 'Confirmed', 'CheckedIn')
              );
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_cancel_reservation(
            p_reservation_id uuid,
            p_reason text
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_status kubo.reservation_status;
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

            SELECT r.status INTO v_status
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_status NOT IN ('Pending', 'Confirmed') THEN
                RAISE EXCEPTION 'Only Pending or Confirmed reservations can be cancelled.'
                    USING ERRCODE = '23514';
            END IF;

            UPDATE kubo.reservation
            SET status = 'Cancelled',
                cancelled_at = clock_timestamp(),
                cancellation_reason = btrim(p_reason)
            WHERE reservation_id = p_reservation_id;

            UPDATE kubo.reserved_kubo
            SET status = 'Cancelled'
            WHERE reservation_id = p_reservation_id;

            PERFORM kubo_reservation_management.fn_release_kubos(p_reservation_id);

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_mark_no_show(
            p_reservation_id uuid
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_status kubo.reservation_status;
            v_first_date date;
            v_first_time time;
        BEGIN
            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT r.status INTO v_status
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_status <> 'Confirmed' THEN
                RAISE EXCEPTION 'Only Confirmed reservations can be marked NoShow.'
                    USING ERRCODE = '23514';
            END IF;

            SELECT MIN(rk.check_in_date), MIN(rk.scheduled_check_in_time)
            INTO v_first_date, v_first_time
            FROM kubo.reserved_kubo AS rk
            WHERE rk.reservation_id = p_reservation_id;

            IF v_first_date IS NULL THEN
                RAISE EXCEPTION 'Reservation has no assignments.'
                    USING ERRCODE = '23514';
            END IF;

            IF CURRENT_DATE < v_first_date
               OR (
                    CURRENT_DATE = v_first_date
                    AND v_first_time IS NOT NULL
                    AND LOCALTIME < v_first_time
               ) THEN
                RAISE EXCEPTION 'The scheduled check-in date/time has not passed yet.'
                    USING ERRCODE = '23514';
            END IF;

            UPDATE kubo.reservation
            SET status = 'NoShow'
            WHERE reservation_id = p_reservation_id;

            UPDATE kubo.reserved_kubo
            SET status = 'NoShow'
            WHERE reservation_id = p_reservation_id;

            PERFORM kubo_reservation_management.fn_release_kubos(p_reservation_id);

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_add_reserved_kubo(
            p_reservation_id uuid,
            p_kubo_id uuid,
            p_check_in_date date,
            p_check_out_date date,
            p_scheduled_check_in_time time DEFAULT NULL,
            p_scheduled_check_out_time time DEFAULT NULL
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_status kubo.reservation_status;
            v_price numeric(10,2);
        BEGIN
            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT r.status INTO v_status
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_status NOT IN ('Pending', 'Confirmed') THEN
                RAISE EXCEPTION 'Only Pending or Confirmed reservations can be modified.'
                    USING ERRCODE = '23514';
            END IF;

            IF p_scheduled_check_in_time IS NOT NULL
               AND p_scheduled_check_out_time IS NOT NULL
               AND p_scheduled_check_out_time <= p_scheduled_check_in_time THEN
                RAISE EXCEPTION 'Scheduled check-out time must be later than scheduled check-in time.'
                    USING ERRCODE = '22023';
            END IF;

            v_price := kubo_reservation_management.fn_validate_kubo_assignment(
                p_kubo_id,
                p_check_in_date,
                p_check_out_date,
                p_reservation_id
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
                p_check_out_date,
                p_scheduled_check_in_time,
                p_scheduled_check_out_time,
                v_price,
                'Reserved'
            );

            UPDATE kubo.kubo AS k
            SET status = 'Reserved'
            WHERE k.kubo_id = p_kubo_id
              AND k.status = 'Available';

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
            p_scheduled_check_out_time time DEFAULT NULL
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_res_status kubo.reservation_status;
            v_current kubo.reserved_kubo%ROWTYPE;
            v_new_check_in date;
            v_new_check_out date;
            v_new_sched_in time;
            v_new_sched_out time;
            v_price numeric(10,2);
            v_dates_changed boolean;
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

            SELECT r.status INTO v_res_status
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_res_status NOT IN ('Pending', 'Confirmed') THEN
                RAISE EXCEPTION 'Only Pending or Confirmed reservations can be modified.'
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

            v_new_check_in := COALESCE(p_check_in_date, v_current.check_in_date);
            v_new_check_out := COALESCE(p_check_out_date, v_current.check_out_date);
            v_new_sched_in := COALESCE(p_scheduled_check_in_time, v_current.scheduled_check_in_time);
            v_new_sched_out := COALESCE(p_scheduled_check_out_time, v_current.scheduled_check_out_time);
            v_dates_changed := p_check_in_date IS NOT NULL OR p_check_out_date IS NOT NULL;

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
                    p_reservation_id
                );
            ELSE
                v_price := v_current.price_at_booking;
            END IF;

            UPDATE kubo.reserved_kubo AS rk
            SET
                check_in_date = v_new_check_in,
                check_out_date = v_new_check_out,
                scheduled_check_in_time = v_new_sched_in,
                scheduled_check_out_time = v_new_sched_out,
                price_at_booking = v_price
            WHERE rk.reservation_id = p_reservation_id
              AND rk.kubo_id = p_kubo_id;

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_delete_reserved_kubo(
            p_reservation_id uuid,
            p_kubo_id uuid
        )
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_res_status kubo.reservation_status;
            v_assign_status kubo.reserved_kubo_status;
            v_count integer;
        BEGIN
            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT r.status INTO v_res_status
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_res_status NOT IN ('Pending', 'Confirmed') THEN
                RAISE EXCEPTION 'Only Pending or Confirmed reservations can be modified.'
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

            DELETE FROM kubo.reserved_kubo AS rk
            WHERE rk.reservation_id = p_reservation_id
              AND rk.kubo_id = p_kubo_id;

            PERFORM kubo_reservation_management.fn_release_kubo(p_kubo_id);

            RETURN TRUE;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_approve_early_check_in(
            p_reservation_id uuid,
            p_kubo_id uuid
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_res_status kubo.reservation_status;
            v_assign_status kubo.reserved_kubo_status;
        BEGIN
            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT r.status INTO v_res_status
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_res_status NOT IN ('Confirmed', 'CheckedIn') THEN
                RAISE EXCEPTION 'Only Confirmed or CheckedIn reservations can approve early check-in.'
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
                RAISE EXCEPTION 'Only Reserved assignments can approve early check-in.'
                    USING ERRCODE = '23514';
            END IF;

            UPDATE kubo.reserved_kubo AS rk
            SET early_check_in_approved = true
            WHERE rk.reservation_id = p_reservation_id
              AND rk.kubo_id = p_kubo_id;

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_check_in_reserved_kubo(
            p_reservation_id uuid,
            p_kubo_id uuid
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_res_status kubo.reservation_status;
            v_assignment kubo.reserved_kubo%ROWTYPE;
            v_kubo_status kubo.kubo_status;
        BEGIN
            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT r.status INTO v_res_status
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

            IF CURRENT_DATE >= v_assignment.check_out_date THEN
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

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_check_out_reserved_kubo(
            p_reservation_id uuid,
            p_kubo_id uuid
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_res_status kubo.reservation_status;
            v_assignment kubo.reserved_kubo%ROWTYPE;
            v_balance numeric;
            v_remaining integer;
        BEGIN
            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT r.status INTO v_res_status
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_res_status <> 'CheckedIn' THEN
                RAISE EXCEPTION 'Check-out requires a CheckedIn reservation.'
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

            IF v_assignment.status <> 'CheckedIn' THEN
                RAISE EXCEPTION 'Only CheckedIn assignments can be checked out.'
                    USING ERRCODE = '23514';
            END IF;

            SELECT b.outstanding_balance INTO v_balance
            FROM kubo_reservation_management.fn_get_reservation_balance(p_reservation_id) AS b;

            IF v_balance <> 0 THEN
                RAISE EXCEPTION 'Outstanding balance must be zero before check-out. Current balance: %.', v_balance
                    USING ERRCODE = '23514';
            END IF;

            UPDATE kubo.reserved_kubo AS rk
            SET status = 'CheckedOut',
                actual_check_out_datetime = clock_timestamp()
            WHERE rk.reservation_id = p_reservation_id
              AND rk.kubo_id = p_kubo_id;

            UPDATE kubo.kubo AS k
            SET status = 'Cleaning'
            WHERE k.kubo_id = p_kubo_id;

            SELECT count(*) INTO v_remaining
            FROM kubo.reserved_kubo AS rk
            WHERE rk.reservation_id = p_reservation_id
              AND rk.status NOT IN ('CheckedOut', 'Cancelled', 'NoShow');

            IF v_remaining = 0 THEN
                UPDATE kubo.reservation AS r
                SET status = 'CheckedOut'
                WHERE r.reservation_id = p_reservation_id;
            END IF;

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_delete_reservation(
            p_reservation_id uuid
        )
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_kubo_ids uuid[];
            v_kubo_id uuid;
        BEGIN
            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RETURN FALSE;
            END IF;

            IF EXISTS (
                SELECT 1 FROM kubo.payment AS p
                WHERE p.reservation_id = p_reservation_id
            ) OR EXISTS (
                SELECT 1 FROM kubo.additional_charge AS ac
                WHERE ac.reservation_id = p_reservation_id
            ) THEN
                RAISE EXCEPTION 'Reservation has financial history; cancel it instead of deleting.'
                    USING ERRCODE = '23503';
            END IF;

            SELECT array_agg(rk.kubo_id)
            INTO v_kubo_ids
            FROM kubo.reserved_kubo AS rk
            WHERE rk.reservation_id = p_reservation_id;

            DELETE FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_kubo_ids IS NOT NULL THEN
                FOREACH v_kubo_id IN ARRAY v_kubo_ids LOOP
                    PERFORM kubo_reservation_management.fn_release_kubo(v_kubo_id);
                END LOOP;
            END IF;

            RETURN TRUE;
        END;
        $function$
    $sql$;
END $$;
