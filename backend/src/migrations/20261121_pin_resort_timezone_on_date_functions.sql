/*
  Migration: 20261121_pin_resort_timezone_on_date_functions.sql
  -------------------------------------------------------------
  Make "today" mean the resort's today inside the reservation routines.

  Stay dates and the early/late fee clock are resort time (Asia/Manila), but
  the routines compared stay dates with CURRENT_DATE, which uses the database
  session time zone (UTC on most hosts). Between 00:00 and 08:00 in Manila the
  database date is still yesterday, so a same-day arrival was refused as an
  "early check-in", and the other date guards drifted the same way.

  Each routine below is re-declared with `SET timezone TO 'Asia/Manila'` in its
  definition. The setting applies only while the routine runs, so session
  settings and timestamptz data are unaffected. Bodies are unchanged from the
  latest earlier definition of each routine.

  IMPORTANT FOR FUTURE MIGRATIONS: CREATE OR REPLACE FUNCTION drops function-level
  settings that the new definition does not repeat. Any later migration that
  redefines one of these routines (or any routine that uses CURRENT_DATE) must
  keep `SET timezone TO 'Asia/Manila'` beside `SET search_path`, or the UTC date
  bug returns silently.

  The final loop also pins any other kubo* routine that uses CURRENT_DATE and
  is not listed here. Idempotent.
*/

DO $$
DECLARE
    v_fn record;
BEGIN
    IF to_regnamespace('kubo_reservation_management') IS NULL
       OR to_regnamespace('kubo_management') IS NULL THEN
        RAISE NOTICE 'reservation/kubo routines are not provisioned; skipping resort-time pin';
        RETURN;
    END IF;

    -- kubo_management.fn_search_available_kubos
    EXECUTE $sql$
CREATE OR REPLACE FUNCTION kubo_management.fn_search_available_kubos(p_check_in date, p_check_out date, p_kubo_type_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(kubo_id uuid, kubo_number character varying, kubo_type_id uuid, type_name character varying, capacity integer, price_per_night numeric, status kubo.kubo_status)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET timezone TO 'Asia/Manila'
AS $function$
        BEGIN
            IF p_check_in IS NULL OR p_check_out IS NULL
               OR p_check_out <= p_check_in THEN
                RAISE EXCEPTION 'Checkout must follow check-in.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_check_in < CURRENT_DATE THEN
                RAISE EXCEPTION 'Check-in date cannot be in the past.'
                    USING ERRCODE = '22023';
            END IF;

            RETURN QUERY
            SELECT
                k.kubo_id,
                k.kubo_number,
                k.kubo_type_id,
                t.type_name,
                t.capacity,
                t.price_per_night,
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
                             AND rk.check_in_date < p_check_out
                             AND rk.check_out_date > p_check_in)
                            OR (rk.status = 'CheckedIn'
                                AND p_check_in <= CURRENT_DATE)
                      )
              )
            ORDER BY k.kubo_number, k.kubo_id;
        END;
        $function$
    $sql$;

    -- kubo_reservation_management.fn_check_in_reserved_kubo
    EXECUTE $sql$
CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_check_in_reserved_kubo(p_reservation_id uuid, p_kubo_id uuid, p_actor_employee_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET timezone TO 'Asia/Manila'
AS $function$
        DECLARE
            v_res_status kubo.reservation_status;
            v_assignment kubo.reserved_kubo%ROWTYPE;
            v_kubo_status kubo.kubo_status;
            v_old json;
            v_early_hours integer;
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

            -- Early check-in fee (issue #107): hours before 12:00 on the arrival day.
            v_early_hours := kubo_reservation_management.fn_time_fee_hours(
                TRUE,
                v_assignment.check_in_date
            );

            IF v_early_hours > 0 THEN
                PERFORM kubo_reservation_management.fn_insert_time_fee(
                    p_reservation_id,
                    p_kubo_id,
                    'EarlyCheckIn',
                    v_early_hours,
                    p_actor_employee_id
                );
            END IF;

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

    -- kubo_reservation_management.fn_generate_reference_code
    EXECUTE $sql$
CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_generate_reference_code()
 RETURNS character varying
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET timezone TO 'Asia/Manila'
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

    -- kubo_reservation_management.fn_mark_no_show
    EXECUTE $sql$
CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_mark_no_show(p_reservation_id uuid, p_actor_employee_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET timezone TO 'Asia/Manila'
AS $function$
        DECLARE
            v_status kubo.reservation_status;
            v_reference varchar(50);
            v_first_date date;
            v_first_time time;
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

            SELECT r.status, r.reference_code
            INTO v_status, v_reference
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

            v_old := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            UPDATE kubo.reservation
            SET status = 'NoShow'
            WHERE reservation_id = p_reservation_id;

            UPDATE kubo.reserved_kubo
            SET status = 'NoShow'
            WHERE reservation_id = p_reservation_id;

            PERFORM kubo_reservation_management.fn_release_kubos(p_reservation_id);

            v_new := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'reservation',
                p_reservation_id,
                format('Marked reservation %s as NoShow', v_reference),
                v_old,
                v_new
            );

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    -- kubo_reservation_management.fn_mark_reserved_kubo_no_show
    EXECUTE $sql$
CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_mark_reserved_kubo_no_show(p_reservation_id uuid, p_kubo_id uuid, p_actor_employee_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET timezone TO 'Asia/Manila'
AS $function$
        DECLARE
            v_res_status kubo.reservation_status;
            v_assignment kubo.reserved_kubo%ROWTYPE;
            v_reference varchar(50);
            v_balance numeric;
            v_remaining integer;
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

            SELECT r.status, r.reference_code
            INTO v_res_status, v_reference
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            IF v_res_status <> 'CheckedIn' THEN
                RAISE EXCEPTION 'Only a CheckedIn reservation can have a single kubo marked NoShow.'
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
                RAISE EXCEPTION 'Only Reserved assignments can be marked NoShow.'
                    USING ERRCODE = '23514';
            END IF;

            IF CURRENT_DATE < v_assignment.check_out_date THEN
                RAISE EXCEPTION 'The stay dates for this kubo have not passed yet.'
                    USING ERRCODE = '23514';
            END IF;

            v_old := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            UPDATE kubo.reserved_kubo AS rk
            SET status = 'NoShow'
            WHERE rk.reservation_id = p_reservation_id
              AND rk.kubo_id = p_kubo_id;

            PERFORM kubo_reservation_management.fn_release_kubos(p_reservation_id);

            SELECT count(*) INTO v_remaining
            FROM kubo.reserved_kubo AS rk
            WHERE rk.reservation_id = p_reservation_id
              AND rk.status NOT IN ('CheckedOut', 'Cancelled', 'NoShow');

            IF v_remaining = 0 THEN
                SELECT b.outstanding_balance INTO v_balance
                FROM kubo_reservation_management.fn_get_reservation_balance(p_reservation_id) AS b;

                IF v_balance <> 0 THEN
                    RAISE EXCEPTION 'Outstanding balance must be zero before the reservation can close. Current balance: %.', v_balance
                        USING ERRCODE = '23514';
                END IF;

                UPDATE kubo.reservation AS r
                SET status = 'CheckedOut'
                WHERE r.reservation_id = p_reservation_id;
            END IF;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'reservation',
                p_reservation_id,
                format('Marked kubo %s as NoShow on reservation %s', p_kubo_id, v_reference),
                v_old,
                kubo_reservation_management.fn_reservation_audit_json(p_reservation_id)
            );

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    -- kubo_reservation_management.fn_validate_kubo_assignment
    EXECUTE $sql$
CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_validate_kubo_assignment(p_kubo_id uuid, p_check_in_date date, p_check_out_date date, p_exclude_reservation_id uuid DEFAULT NULL::uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET timezone TO 'Asia/Manila'
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

    FOR v_fn IN
        SELECT p.oid::regprocedure AS signature
        FROM pg_proc AS p
        JOIN pg_namespace AS n ON n.oid = p.pronamespace
        WHERE n.nspname LIKE 'kubo%'
          AND p.prokind = 'f'
          AND p.prosrc ILIKE '%current\_date%'
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %s SET timezone TO %L',
            v_fn.signature,
            'Asia/Manila'
        );
    END LOOP;
END $$;
