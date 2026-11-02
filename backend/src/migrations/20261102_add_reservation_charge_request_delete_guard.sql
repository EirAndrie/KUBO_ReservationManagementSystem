/*
  Migration: 20261102_add_reservation_charge_request_delete_guard.sql
  -------------------------------------------------------------------
  Prevents repair deletion of a reservation that still has custom
  additional-charge request history. Requests are retained for audit and
  must not be cascaded away by a reservation delete.
*/

DO $$
BEGIN
    IF to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.additional_charge_request') IS NULL THEN
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
