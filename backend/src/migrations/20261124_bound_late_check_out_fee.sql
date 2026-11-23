/*
  Migration: 20261124_bound_late_check_out_fee.sql
  ------------------------------------------------
  Bounds the late check-out fee (follow-up to issue #141).

  Before, the fee counted every hour past 12:00 on the check-out date, so a
  guest who overstayed by days was billed hundreds of hours in one line. Now:

  - The hourly late fee covers 12:00 to midnight of the check-out date, at most
    12 hours (PHP 150.00 each).
  - Each calendar day past the check-out date is one overstay night at the
    nightly rate booked (`reserved_kubo.price_at_booking`). It is stored as an
    `Other` charge linked by `time_fee_kubo_id`, so Staff cannot delete it, and it
    is topped up when the overstay grows (`fn_apply_late_check_out_fee`).
  - `fn_get_time_fees` folds the nights into `late_fee`, and `late_applied` stays
    false until the nights are on the bill, so the existing check-out flow
    applies them with no API change.
  - `fn_check_out_reserved_kubo` refuses to check out until the nights are billed.

  Builds on 20261123_cap_early_check_in_fee_hours.sql (the early cap in
  `fn_time_fee_hours`) and re-declares the routines from
  20261120_add_early_late_checkout_fees.sql.
*/

DO $$
BEGIN
    IF to_regnamespace('kubo_reservation_management') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_time_fee_hours(boolean,date)') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_get_time_fees(uuid,uuid)') IS NULL THEN
        RAISE NOTICE 'time fee routines are not provisioned; skipping late fee bound';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_time_fee_hours(
            p_early boolean,
            p_standard_day date
        )
        RETURNS integer
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_now timestamp := clock_timestamp() AT TIME ZONE 'Asia/Manila';
            v_standard timestamp := p_standard_day + time '12:00';
            v_seconds numeric;
        BEGIN
            IF p_early THEN
                -- Only the arrival-day morning is billable: never before 00:00.
                v_seconds := extract(
                    epoch FROM (v_standard - greatest(v_now, p_standard_day::timestamp))
                );
            ELSE
                -- Only the check-out day afternoon is hourly: at most 12 hours.
                -- Later days are billed as overstay nights.
                v_seconds := least(extract(epoch FROM (v_now - v_standard)), 12 * 3600);
            END IF;

            RETURN greatest(0, ceil(v_seconds / 3600.0))::integer;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_overstay_nights(
            p_check_out_date date
        )
        RETURNS integer
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
            SELECT greatest(0, (clock_timestamp() AT TIME ZONE 'Asia/Manila')::date - p_check_out_date)
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_get_time_fees(
                p_reservation_id uuid,
                p_kubo_id uuid
            )
            RETURNS TABLE(
                hourly_rate numeric,
                early_hours integer,
                early_fee numeric,
                early_applied boolean,
                late_hours integer,
                late_fee numeric,
                late_applied boolean
            )
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path TO 'pg_catalog', 'pg_temp'
            AS $function$
            DECLARE
                c_hourly_rate CONSTANT numeric(10,2) := 150.00;
                v_assignment kubo.reserved_kubo%ROWTYPE;
                v_early kubo.additional_charge%ROWTYPE;
                v_late kubo.additional_charge%ROWTYPE;
                v_night kubo.additional_charge%ROWTYPE;
                v_nights_due integer := 0;
                v_nights_billed integer;
                v_early_hours integer := 0;
                v_late_hours integer := 0;
            BEGIN
                SELECT rk.* INTO v_assignment
                FROM kubo.reserved_kubo AS rk
                WHERE rk.reservation_id = p_reservation_id
                  AND rk.kubo_id = p_kubo_id;
    
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Reserved kubo does not exist.'
                        USING ERRCODE = 'P0002';
                END IF;
    
                SELECT ac.* INTO v_early
                FROM kubo.additional_charge AS ac
                WHERE ac.reservation_id = p_reservation_id
                  AND ac.time_fee_kubo_id = p_kubo_id
                  AND ac.charge_type = 'EarlyCheckIn';
    
                SELECT ac.* INTO v_late
                FROM kubo.additional_charge AS ac
                WHERE ac.reservation_id = p_reservation_id
                  AND ac.time_fee_kubo_id = p_kubo_id
                  AND ac.charge_type = 'LateCheckOut';
    
                SELECT ac.* INTO v_night
                FROM kubo.additional_charge AS ac
                WHERE ac.reservation_id = p_reservation_id
                  AND ac.time_fee_kubo_id = p_kubo_id
                  AND ac.charge_type = 'Other';
    
                IF v_assignment.status = 'CheckedIn' THEN
                    v_nights_due := kubo_reservation_management.fn_overstay_nights(v_assignment.check_out_date);
                END IF;
    
                v_nights_billed := COALESCE(v_night.quantity, 0);
    
                IF v_early.charge_id IS NULL AND v_assignment.status = 'Reserved' THEN
                    v_early_hours := kubo_reservation_management.fn_time_fee_hours(
                        TRUE, v_assignment.check_in_date
                    );
                END IF;
    
                IF v_late.charge_id IS NULL AND v_assignment.status = 'CheckedIn' THEN
                    v_late_hours := kubo_reservation_management.fn_time_fee_hours(
                        FALSE, v_assignment.check_out_date
                    );
                END IF;
    
                RETURN QUERY
                SELECT
                    c_hourly_rate,
                    COALESCE(v_early.quantity, v_early_hours),
                    COALESCE(v_early.amount, round(v_early_hours * c_hourly_rate, 2)),
                    v_early.charge_id IS NOT NULL,
                    COALESCE(v_late.quantity, v_late_hours),
                    COALESCE(v_late.amount, round(v_late_hours * c_hourly_rate, 2))
                        + COALESCE(v_night.amount, 0)
                        + round(greatest(v_nights_due - v_nights_billed, 0) * v_assignment.price_at_booking, 2),
                    v_late.charge_id IS NOT NULL AND v_nights_billed >= v_nights_due;
            END;
            $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_apply_late_check_out_fee(
                p_reservation_id uuid,
                p_kubo_id uuid,
                p_actor_employee_id uuid
            )
            RETURNS TABLE(
                charge_id uuid,
                hours integer,
                amount numeric
            )
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path TO 'pg_catalog', 'pg_temp'
            AS $function$
            DECLARE
                v_status kubo.reserved_kubo_status;
                v_check_out_date date;
                v_price numeric;
                v_hours integer;
                v_nights_due integer;
                v_night kubo.additional_charge%ROWTYPE;
                v_late kubo.additional_charge%ROWTYPE;
                v_kubo_number text;
                v_charge_id uuid;
                v_night_id uuid;
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
    
                SELECT rk.status, rk.check_out_date, rk.price_at_booking
                INTO v_status, v_check_out_date, v_price
                FROM kubo.reserved_kubo AS rk
                WHERE rk.reservation_id = p_reservation_id
                  AND rk.kubo_id = p_kubo_id
                FOR UPDATE;
    
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Reserved kubo does not exist.'
                        USING ERRCODE = 'P0002';
                END IF;
    
                IF v_status <> 'CheckedIn' THEN
                    RAISE EXCEPTION 'Only a CheckedIn kubo can be charged a late check-out fee.'
                        USING ERRCODE = '23514';
                END IF;
    
                SELECT ac.* INTO v_late
                FROM kubo.additional_charge AS ac
                WHERE ac.reservation_id = p_reservation_id
                  AND ac.time_fee_kubo_id = p_kubo_id
                  AND ac.charge_type = 'LateCheckOut';
    
                -- The hourly fee is fixed when first applied (at most 12 hours).
                IF v_late.charge_id IS NULL THEN
                    v_hours := kubo_reservation_management.fn_time_fee_hours(FALSE, v_check_out_date);
    
                    IF v_hours <= 0 THEN
                        RAISE EXCEPTION 'No late check-out fee applies.'
                            USING ERRCODE = '23514';
                    END IF;
    
                    v_charge_id := kubo_reservation_management.fn_insert_time_fee(
                        p_reservation_id,
                        p_kubo_id,
                        'LateCheckOut',
                        v_hours,
                        p_actor_employee_id
                    );
                ELSE
                    v_charge_id := v_late.charge_id;
                END IF;
    
                -- Each calendar day past the check-out date is one more night at the
                -- nightly rate booked. The row is topped up as the overstay grows.
                v_nights_due := kubo_reservation_management.fn_overstay_nights(v_check_out_date);
    
                IF v_nights_due > 0 THEN
                    SELECT ac.* INTO v_night
                    FROM kubo.additional_charge AS ac
                    WHERE ac.reservation_id = p_reservation_id
                      AND ac.time_fee_kubo_id = p_kubo_id
                      AND ac.charge_type = 'Other';
    
                    SELECT k.kubo_number INTO v_kubo_number
                    FROM kubo.kubo AS k
                    WHERE k.kubo_id = p_kubo_id;
    
                    IF v_night.charge_id IS NULL THEN
                        INSERT INTO kubo.additional_charge (
                            reservation_id, employee_id, charge_type, quantity,
                            unit_amount, amount, description, time_fee_kubo_id
                        )
                        VALUES (
                            p_reservation_id,
                            p_actor_employee_id,
                            'Other',
                            v_nights_due,
                            v_price,
                            round(v_nights_due * v_price, 2),
                            format('Overstay: kubo %s, %s night(s) past check-out at PHP %s/night', v_kubo_number, v_nights_due, v_price),
                            p_kubo_id
                        )
                        RETURNING additional_charge.charge_id INTO v_night_id;
    
                        PERFORM kubo_audit_management.write_audit_log(
                            p_actor_employee_id,
                            'Create'::kubo.audit_action,
                            'additional_charge',
                            v_night_id,
                            format('Applied overstay nights for kubo %s (%s night(s))', v_kubo_number, v_nights_due),
                            NULL,
                            (SELECT to_json(ac) FROM kubo.additional_charge AS ac WHERE ac.charge_id = v_night_id)
                        );
                    ELSIF v_night.quantity < v_nights_due THEN
                        v_old := to_json(v_night);
    
                        UPDATE kubo.additional_charge AS ac
                        SET quantity = v_nights_due,
                            amount = round(v_nights_due * ac.unit_amount, 2),
                            description = format('Overstay: kubo %s, %s night(s) past check-out at PHP %s/night', v_kubo_number, v_nights_due, ac.unit_amount)
                        WHERE ac.charge_id = v_night.charge_id;
    
                        PERFORM kubo_audit_management.write_audit_log(
                            p_actor_employee_id,
                            'Update'::kubo.audit_action,
                            'additional_charge',
                            v_night.charge_id,
                            format('Extended overstay nights for kubo %s to %s', v_kubo_number, v_nights_due),
                            v_old,
                            (SELECT to_json(ac) FROM kubo.additional_charge AS ac WHERE ac.charge_id = v_night.charge_id)
                        );
                    END IF;
                END IF;
    
                -- One row for the caller: the hourly fee plus any overstay nights.
                RETURN QUERY
                SELECT v_charge_id,
                       (SELECT ac.quantity FROM kubo.additional_charge AS ac WHERE ac.charge_id = v_charge_id),
                       (SELECT COALESCE(sum(ac.amount), 0)
                        FROM kubo.additional_charge AS ac
                        WHERE ac.reservation_id = p_reservation_id
                          AND ac.time_fee_kubo_id = p_kubo_id
                          AND ac.charge_type IN ('LateCheckOut', 'Other'));
            END;
            $function$
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
                v_late_hours integer;
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
    
                -- Late check-out fee (issue #107): it must be on the bill before the
                -- zero-balance rule below is evaluated, so it cannot be skipped.
                v_late_hours := kubo_reservation_management.fn_time_fee_hours(
                    FALSE,
                    v_assignment.check_out_date
                );
    
                IF v_late_hours > 0
                   AND NOT EXISTS (
                        SELECT 1
                        FROM kubo.additional_charge AS ac
                        WHERE ac.reservation_id = p_reservation_id
                          AND ac.time_fee_kubo_id = p_kubo_id
                          AND ac.charge_type = 'LateCheckOut'
                   ) THEN
                    RAISE EXCEPTION 'A late check-out fee applies (% hour(s) past 12:00). Apply the fee before checking out.', v_late_hours
                        USING ERRCODE = '23514';
                END IF;
    
                -- Overstay nights must also be on the bill.
                IF kubo_reservation_management.fn_overstay_nights(v_assignment.check_out_date) > COALESCE((
                        SELECT ac.quantity
                        FROM kubo.additional_charge AS ac
                        WHERE ac.reservation_id = p_reservation_id
                          AND ac.time_fee_kubo_id = p_kubo_id
                          AND ac.charge_type = 'Other'
                   ), 0) THEN
                    RAISE EXCEPTION 'The guest is past the check-out date. Apply the late check-out fee before checking out.'
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
