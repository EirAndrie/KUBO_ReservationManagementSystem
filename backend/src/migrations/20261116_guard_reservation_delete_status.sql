/*
  Migration: 20261116_guard_reservation_delete_status.sql
  -------------------------------------------------------
  Blocks the repair-only hard delete for reservations whose guest has already
  arrived (BR-038).

  Before this migration fn_delete_reservation only refused reservations with
  payments or additional charges. A CheckedIn reservation without either could
  be deleted, and the delete then released its kubos (fn_release_kubo) while the
  guest was still occupying them. CheckedOut reservations are history and must
  not be removed either.

  Deletion is still allowed for Pending, Confirmed, Cancelled, and NoShow
  reservations without financial history. Everything else in the function is
  unchanged from 20261108_fix_reservation_delete_and_payment_adjustments.sql.
  The charge-request trigger guard from 20261102 is not affected.
*/

DO $$
BEGIN
    IF to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL
       OR to_regclass('kubo.payment') IS NULL
       OR to_regclass('kubo.additional_charge') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_reservation_audit_json(uuid)') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_release_kubo(uuid)') IS NULL
       OR to_regprocedure('kubo_audit_management.write_audit_log(uuid,kubo.audit_action,character varying,uuid,text,json,json)') IS NULL THEN
        RAISE NOTICE 'Reservation delete dependencies are not provisioned; skipping migration';
        RETURN;
    END IF;

    EXECUTE $fn$
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
            v_status kubo.reservation_status;
            v_kubo_ids uuid[];
            v_kubo_id uuid;
            v_old json;
        BEGIN
            SELECT r.status
            INTO v_status
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RETURN FALSE;
            END IF;

            -- A guest who has arrived occupies the kubo; deleting would
            -- release it underneath them. Checked-out stays are history.
            IF v_status IN ('CheckedIn', 'CheckedOut') THEN
                RAISE EXCEPTION 'Reservation is % and cannot be deleted.', v_status
                    USING ERRCODE = '23514';
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

            DELETE FROM kubo.reserved_kubo AS rk
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
    $fn$;
END $$;
