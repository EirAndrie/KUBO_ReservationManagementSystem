/*
  Migration: 20261104_wire_reservation_audit.sql
  -------------------------------------------------
  Wires audit-log writes into the reservation and reserved-kubo mutation
  routines (BR-067, BR-068, BR-071).

  - Adds an acting-employee parameter to every reservation/assignment
    mutation (except fn_create_reservation, which already takes the creating
    employee).
  - Each mutation writes one audit row inside the same transaction, so a
    failed mutation rolls the audit row back.
  - Assignment/check-in/check-out events are audited under entity_type
    'reservation' using the reservation_id because kubo.reserved_kubo has no
    single UUID primary key.
  - Audit values are built with an explicit JSON helper so no secrets or
    derived totals leak into the log.
*/

DO $$
BEGIN
    IF to_regclass('kubo.audit_log') IS NULL
       OR to_regclass('kubo.reservation') IS NULL
       OR to_regnamespace('kubo_reservation_management') IS NULL THEN
        RAISE NOTICE 'kubo.reservation or audit_log is not provisioned; skipping reservation audit wiring';
        RETURN;
    END IF;

    -------------------------------------------------------------------------
    -- Shared JSON snapshot helper (safe, explicit fields only)
    -------------------------------------------------------------------------

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
    -- fn_create_reservation (signature unchanged; add audit write)
    -------------------------------------------------------------------------

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

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Create'::kubo.audit_action,
                'reservation',
                v_reservation_id,
                format('Created reservation %s', v_reference),
                NULL,
                kubo_reservation_management.fn_reservation_audit_json(v_reservation_id)
            );

            RETURN v_reservation_id;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- fn_update_reservation
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_update_reservation(uuid, uuid, kubo.booking_source)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_update_reservation(
            p_reservation_id uuid,
            p_guest_id uuid DEFAULT NULL,
            p_booking_source kubo.booking_source DEFAULT NULL,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_status kubo.reservation_status;
            v_reference varchar(50);
            v_old json;
            v_new json;
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

            SELECT r.status, r.reference_code
            INTO v_status, v_reference
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

            v_old := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            UPDATE kubo.reservation AS r
            SET
                guest_id = COALESCE(p_guest_id, r.guest_id),
                booking_source = COALESCE(p_booking_source, r.booking_source)
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
    -- fn_confirm_reservation
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_confirm_reservation(uuid)
    $sql$;

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
            v_reference varchar(50);
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
                format('Confirmed reservation %s', v_reference),
                v_old,
                v_new
            );

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- fn_cancel_reservation
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_cancel_reservation(uuid, text)
    $sql$;

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
            v_reference varchar(50);
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

            SELECT r.status, r.reference_code
            INTO v_status, v_reference
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
            WHERE reservation_id = p_reservation_id;

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
                format('Cancelled reservation %s', v_reference),
                v_old,
                v_new
            );

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- fn_mark_no_show
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_mark_no_show(uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_mark_no_show(
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

    -------------------------------------------------------------------------
    -- fn_delete_reservation
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_delete_reservation(uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_delete_reservation(
            p_reservation_id uuid,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_kubo_ids uuid[];
            v_kubo_id uuid;
            v_old json;
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

            v_old := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            SELECT array_agg(rk.kubo_id)
            INTO v_kubo_ids
            FROM kubo.reserved_kubo AS rk
            WHERE rk.reservation_id = p_reservation_id;

            DELETE FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Delete'::kubo.audit_action,
                'reservation',
                p_reservation_id,
                format('Deleted reservation %s', v_old->>'reference_code'),
                v_old,
                NULL
            );

            IF v_kubo_ids IS NOT NULL THEN
                FOREACH v_kubo_id IN ARRAY v_kubo_ids LOOP
                    PERFORM kubo_reservation_management.fn_release_kubo(v_kubo_id);
                END LOOP;
            END IF;

            RETURN TRUE;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- fn_add_reserved_kubo
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_add_reserved_kubo(uuid, uuid, date, date, time, time)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_add_reserved_kubo(
            p_reservation_id uuid,
            p_kubo_id uuid,
            p_check_in_date date,
            p_check_out_date date,
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

    -------------------------------------------------------------------------
    -- fn_update_reserved_kubo
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_update_reserved_kubo(uuid, uuid, date, date, time, time)
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

    -------------------------------------------------------------------------
    -- fn_delete_reserved_kubo
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_delete_reserved_kubo(uuid, uuid)
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
    -- fn_approve_early_check_in
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_approve_early_check_in(uuid, uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_approve_early_check_in(
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
            v_assign_status kubo.reserved_kubo_status;
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

            v_old := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            UPDATE kubo.reserved_kubo AS rk
            SET early_check_in_approved = true
            WHERE rk.reservation_id = p_reservation_id
              AND rk.kubo_id = p_kubo_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'reservation',
                p_reservation_id,
                format('Approved early check-in for kubo %s', p_kubo_id),
                v_old,
                kubo_reservation_management.fn_reservation_audit_json(p_reservation_id)
            );

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- fn_check_in_reserved_kubo
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_check_in_reserved_kubo(uuid, uuid)
    $sql$;

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
    -- fn_check_out_reserved_kubo
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_check_out_reserved_kubo(uuid, uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_check_out_reserved_kubo(
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
            v_assignment kubo.reserved_kubo%ROWTYPE;
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

            v_old := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

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

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'reservation',
                p_reservation_id,
                format('Checked out kubo %s', p_kubo_id),
                v_old,
                kubo_reservation_management.fn_reservation_audit_json(p_reservation_id)
            );

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;

END $$;
