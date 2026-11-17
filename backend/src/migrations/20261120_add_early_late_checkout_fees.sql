/*
  Migration: 20261120_add_early_late_checkout_fees.sql
  ----------------------------------------------------
  Standard stay times and the early/late fee (issue #107).

  - The standard stay runs from 12:00 on the check-in date to 12:00 on the
    check-out date, resort time (Asia/Manila).
  - Checking in before 12:00 on the check-in date, or earlier, adds an
    `EarlyCheckIn` charge: whole hours before 12:00 (a part hour counts as a
    full hour) at PHP 150.00 per hour.
  - Checking out after 12:00 on the check-out date requires a `LateCheckOut`
    charge computed the same way. Check-out is refused until it is applied
    (`fn_apply_late_check_out_fee`); the zero-balance check-out rule then makes
    the guest settle it. The fee is fixed when it is applied.
  - Both fees are ordinary `additional_charge` rows. New column
    `time_fee_kubo_id` links a fee to its kubo, and a unique index allows one
    fee of each type per kubo per reservation.
  - `fn_get_time_fees` previews both fees for the front desk.

  fn_check_in_reserved_kubo and fn_check_out_reserved_kubo are
  20261104_wire_reservation_audit.sql with only the fee steps added.
*/

DO $$
BEGIN
    IF to_regclass('kubo.additional_charge') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL
       OR to_regnamespace('kubo_reservation_management') IS NULL THEN
        RAISE NOTICE 'reservation/charge tables are not provisioned; skipping early/late fees';
        RETURN;
    END IF;

    EXECUTE $sql$
        ALTER TABLE kubo.additional_charge
        ADD COLUMN IF NOT EXISTS time_fee_kubo_id uuid
    $sql$;

    EXECUTE $sql$
        CREATE UNIQUE INDEX IF NOT EXISTS additional_charge_time_fee_unique
        ON kubo.additional_charge (reservation_id, time_fee_kubo_id, charge_type)
        WHERE time_fee_kubo_id IS NOT NULL
    $sql$;

    -------------------------------------------------------------------------
    -- fn_time_fee_hours: billable hours before/after 12:00 of a stay day
    -------------------------------------------------------------------------

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
            v_seconds := extract(
                epoch FROM (CASE WHEN p_early THEN v_standard - v_now ELSE v_now - v_standard END)
            );

            RETURN greatest(0, ceil(v_seconds / 3600.0))::integer;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- fn_insert_time_fee: write the fee charge and its audit row
    -------------------------------------------------------------------------

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_insert_time_fee(
            p_reservation_id uuid,
            p_kubo_id uuid,
            p_charge_type kubo.charge_type,
            p_hours integer,
            p_actor_employee_id uuid
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            c_hourly_rate CONSTANT numeric(10,2) := 150.00;
            v_kubo_number text;
            v_charge_id uuid;
        BEGIN
            SELECT k.kubo_number INTO v_kubo_number
            FROM kubo.kubo AS k
            WHERE k.kubo_id = p_kubo_id;

            INSERT INTO kubo.additional_charge (
                reservation_id,
                employee_id,
                charge_type,
                quantity,
                unit_amount,
                amount,
                description,
                time_fee_kubo_id
            )
            VALUES (
                p_reservation_id,
                p_actor_employee_id,
                p_charge_type,
                p_hours,
                c_hourly_rate,
                round(p_hours * c_hourly_rate, 2),
                format(
                    '%s fee: kubo %s, %s hour(s) at PHP %s/hour',
                    CASE WHEN p_charge_type = 'EarlyCheckIn' THEN 'Early check-in' ELSE 'Late check-out' END,
                    v_kubo_number,
                    p_hours,
                    c_hourly_rate
                ),
                p_kubo_id
            )
            RETURNING charge_id INTO v_charge_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Create'::kubo.audit_action,
                'additional_charge',
                v_charge_id,
                format('Applied %s fee for kubo %s (%s hour(s))', p_charge_type, v_kubo_number, p_hours),
                NULL,
                (SELECT to_json(ac) FROM kubo.additional_charge AS ac WHERE ac.charge_id = v_charge_id)
            );

            RETURN v_charge_id;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- fn_get_time_fees: preview (or the applied values) for one assignment
    -------------------------------------------------------------------------

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
                COALESCE(v_late.amount, round(v_late_hours * c_hourly_rate, 2)),
                v_late.charge_id IS NOT NULL;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- fn_apply_late_check_out_fee: put the late fee on the bill
    -------------------------------------------------------------------------

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
            v_hours integer;
            v_charge_id uuid;
        BEGIN
            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT rk.status, rk.check_out_date
            INTO v_status, v_check_out_date
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

            -- Idempotent: the fee is fixed when first applied.
            RETURN QUERY
            SELECT ac.charge_id, ac.quantity, ac.amount
            FROM kubo.additional_charge AS ac
            WHERE ac.reservation_id = p_reservation_id
              AND ac.time_fee_kubo_id = p_kubo_id
              AND ac.charge_type = 'LateCheckOut';

            IF FOUND THEN
                RETURN;
            END IF;

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

            RETURN QUERY
            SELECT ac.charge_id, ac.quantity, ac.amount
            FROM kubo.additional_charge AS ac
            WHERE ac.charge_id = v_charge_id;
        END;
        $function$
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
