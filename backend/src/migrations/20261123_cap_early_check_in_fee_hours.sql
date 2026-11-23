/*
  Migration: 20261123_cap_early_check_in_fee_hours.sql
  ----------------------------------------------------
  Bounds the early check-in fee (issue #141).

  fn_time_fee_hours counted every hour between now and 12:00 on the check-in
  date, so an approved check-in weeks early billed hundreds of hours (a 2099
  stay previewed PHP 94.8M). The early fee now covers only the morning of the
  arrival day: hours from 00:00 to 12:00 on `check_in_date`, at most 12. Time
  on earlier dates is not billed as an early check-in fee.

  Because that cap leaves earlier nights unbilled, fn_approve_early_check_in now
  refuses an approval before the arrival day (resort time).

  The late check-out branch is unchanged. The function keeps its
  SECURITY DEFINER and pinned search_path from 20261120.
*/

DO $$
BEGIN
    IF to_regnamespace('kubo_reservation_management') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_time_fee_hours(boolean,date)') IS NULL THEN
        RAISE NOTICE 'fn_time_fee_hours is not provisioned; skipping early fee cap';
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
                v_seconds := extract(epoch FROM (v_now - v_standard));
            END IF;

            RETURN greatest(0, ceil(v_seconds / 3600.0))::integer;
        END;
        $function$
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
                v_check_in date;
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
    
                SELECT rk.status, rk.check_in_date INTO v_assign_status, v_check_in
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
    
                -- The early fee only covers the arrival-day morning, so an approval
                -- for an earlier day would let the guest stay unbilled.
                IF v_check_in > (clock_timestamp() AT TIME ZONE 'Asia/Manila')::date THEN
                    RAISE EXCEPTION 'Early check-in can only be approved on the arrival day.'
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
END $$;
