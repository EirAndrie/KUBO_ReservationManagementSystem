/*
  Migration: 20261118_reapply_reservation_charge_request_delete_guard.sql
  -----------------------------------------------------------------------
  Reinstalls the guard from 20261102_add_reservation_charge_request_delete_guard.sql.

  That migration sorts before 20261102_harden_additional_charge_management.sql,
  which is what creates kubo.additional_charge_request. On a database built from
  scratch the guard therefore found no request table and skipped itself. Existing
  databases already have the guard, so for them this is a no-op re-creation of the
  same function and trigger.

  Prevents repair deletion of a reservation that still has custom
  additional-charge request history. Requests are retained for audit and
  must not be cascaded away by a reservation delete.
*/

DO $$
BEGIN
    IF to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.additional_charge_request') IS NULL
       OR to_regnamespace('kubo_reservation_management') IS NULL THEN
        RAISE NOTICE 'Reservation/charge-request tables are not provisioned; skipping delete guard';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.prevent_reservation_delete_with_charge_requests()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM kubo.additional_charge_request AS cr
                WHERE cr.reservation_id = OLD.reservation_id
            ) THEN
                RAISE EXCEPTION 'Reservation has custom charge-request history; cancel it instead of deleting.'
                    USING ERRCODE = '23503';
            END IF;

            RETURN OLD;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        DROP TRIGGER IF EXISTS reservation_charge_request_delete_guard ON kubo.reservation
    $sql$;

    EXECUTE $sql$
        CREATE TRIGGER reservation_charge_request_delete_guard
        BEFORE DELETE ON kubo.reservation
        FOR EACH ROW
        EXECUTE FUNCTION kubo_reservation_management.prevent_reservation_delete_with_charge_requests()
    $sql$;
END $$;
