/*
  Migration: 20261124_require_arrival_day_for_early_check_in.sql
  --------------------------------------------------------------
  Early check-in can only be approved on the arrival day (issue #141).

  20261123_cap_early_check_in_fee_hours.sql bills at most the 12 hours before
  noon on `check_in_date`, so an approval for an earlier day would let the guest
  stay the extra nights unbilled. fn_approve_early_check_in now refuses an
  approval before the arrival day (resort time).

  The function is 20261104_wire_reservation_audit.sql with only that check added.
*/

DO $$
BEGIN
    IF to_regprocedure('kubo_reservation_management.fn_approve_early_check_in(uuid,uuid,uuid)') IS NULL THEN
        RAISE NOTICE 'fn_approve_early_check_in is not provisioned; skipping arrival-day guard';
        RETURN;
    END IF;

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
