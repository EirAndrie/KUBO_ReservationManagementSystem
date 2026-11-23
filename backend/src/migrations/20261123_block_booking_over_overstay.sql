/*
  Migration: 20261123_block_booking_over_overstay.sql
  ---------------------------------------------------
  Closes the overstay gap (issue #67 follow-up).

  A guest still `CheckedIn` after the assignment's check-out date keeps the
  kubo, but the date-range overlap check treats the stay as over. The search
  (`fn_search_available_kubos`) already hides such a kubo for a stay that
  starts today or earlier; `fn_validate_kubo_assignment`, which every create,
  add-kubo, update and reassign goes through, did not, so a booking could be
  made on a kubo that is still occupied.

  fn_validate_kubo_assignment now also refuses a stay starting today or
  earlier when another reservation's assignment on that kubo is still
  `CheckedIn`. Later start dates are unaffected. Body is the one from
  20261121_pin_resort_timezone_on_date_functions.sql plus that check, and it
  keeps `SET timezone TO 'Asia/Manila'`.
*/

DO $$
BEGIN
    IF to_regprocedure('kubo_reservation_management.fn_validate_kubo_assignment(uuid,date,date,uuid)') IS NULL THEN
        RAISE NOTICE 'fn_validate_kubo_assignment is not provisioned; skipping overstay check';
        RETURN;
    END IF;

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
                  AND (
                        (rk.status IN ('Reserved', 'CheckedIn')
                         AND r.status IN ('Pending', 'Confirmed', 'CheckedIn')
                         AND rk.check_in_date < p_check_out_date
                         AND rk.check_out_date > p_check_in_date)
                        -- Overstay: the guest is still in the kubo after the
                        -- booked check-out date, so it is not free to book.
                        OR (rk.status = 'CheckedIn'
                            AND p_check_in_date <= CURRENT_DATE)
                  )
            ) THEN
                RAISE EXCEPTION 'Kubo is not available for the selected dates.'
                    USING ERRCODE = '23514';
            END IF;

            RETURN v_price;
        END;
        $function$
    $sql$;
END $$;
