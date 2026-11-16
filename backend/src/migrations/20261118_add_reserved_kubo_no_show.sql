/*
  Migration: 20261118_add_reserved_kubo_no_show.sql
  -------------------------------------------------
  Issue #67: in a multi-kubo stay, an assignment that was never checked in
  stayed `Reserved` forever once its dates passed. Check-in is refused on or
  after check_out_date (BR-059) and check-out needs a CheckedIn assignment
  (BR-062), so the reservation could never leave `CheckedIn`.

  Added: kubo_reservation_management.fn_mark_reserved_kubo_no_show(
             p_reservation_id, p_kubo_id, p_actor_employee_id)
  - Reservation must be CheckedIn (a Confirmed reservation uses fn_mark_no_show).
  - Assignment must be Reserved and CURRENT_DATE >= its check_out_date.
  - Sets the assignment to NoShow and releases the kubo if nothing else holds it.
  - When no assignment is left open, the reservation becomes CheckedOut
    (BR-063). Because the NoShow assignment no longer counts toward the
    balance, the outstanding balance must be zero first (BR-064); otherwise
    the whole call fails and nothing changes.
  - Audited in the same transaction.
*/

DO $$
BEGIN
    IF to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL
       OR to_regclass('kubo.kubo') IS NULL
       OR to_regclass('kubo.audit_log') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_reservation_audit_json(uuid)') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_release_kubos(uuid)') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_get_reservation_balance(uuid)') IS NULL THEN
        RAISE NOTICE 'Reservation routines are not provisioned; skipping fn_mark_reserved_kubo_no_show';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_mark_reserved_kubo_no_show(
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
END $$;
