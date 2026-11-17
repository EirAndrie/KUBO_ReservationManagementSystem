/*
  Migration: 20261119_add_reassign_reserved_kubo.sql
  --------------------------------------------------
  Adds kubo_reservation_management.fn_reassign_reserved_kubo (issue #70).

  Staff can replace a Reserved assignment of a Pending or Confirmed reservation
  with another kubo, for example when the assigned kubo is later set to Out of
  Service or Maintenance. The new assignment keeps the same stay dates and
  scheduled times and takes the new kubo's current nightly rate.

  The swap is one transaction: the new kubo is added first (so the reservation
  never drops below one assignment), then the old one is removed. Availability,
  kubo status and overlap checks come from fn_add_reserved_kubo, and each step
  writes its own audit row. Reassigning to the same kubo, or a kubo that is not
  available for those dates, is refused and nothing changes.
*/

DO $$
BEGIN
    IF to_regnamespace('kubo_reservation_management') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL THEN
        RAISE NOTICE 'reservation management is not provisioned; skipping fn_reassign_reserved_kubo';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_reassign_reserved_kubo(
            p_reservation_id uuid,
            p_old_kubo_id uuid,
            p_new_kubo_id uuid,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_check_in_date date;
            v_check_out_date date;
            v_check_in_time time;
            v_check_out_time time;
            v_status kubo.reserved_kubo_status;
        BEGIN
            IF p_new_kubo_id IS NULL OR p_new_kubo_id = p_old_kubo_id THEN
                RAISE EXCEPTION 'Choose a different kubo to reassign to.'
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

            SELECT rk.status, rk.check_in_date, rk.check_out_date,
                   rk.scheduled_check_in_time, rk.scheduled_check_out_time
            INTO v_status, v_check_in_date, v_check_out_date,
                 v_check_in_time, v_check_out_time
            FROM kubo.reserved_kubo AS rk
            WHERE rk.reservation_id = p_reservation_id
              AND rk.kubo_id = p_old_kubo_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reserved kubo does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_status <> 'Reserved' THEN
                RAISE EXCEPTION 'Only Reserved assignments can be reassigned.'
                    USING ERRCODE = '23514';
            END IF;

            -- Both calls enforce the Pending/Confirmed reservation rule.
            PERFORM kubo_reservation_management.fn_add_reserved_kubo(
                p_reservation_id,
                p_new_kubo_id,
                v_check_in_date,
                v_check_out_date,
                v_check_in_time,
                v_check_out_time,
                p_actor_employee_id
            );

            PERFORM kubo_reservation_management.fn_delete_reserved_kubo(
                p_reservation_id,
                p_old_kubo_id,
                p_actor_employee_id
            );

            RETURN p_reservation_id;
        END;
        $function$
    $sql$;
END $$;
