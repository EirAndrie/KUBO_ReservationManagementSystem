/*
  Migration: 20261116_require_reservation_kubo_assignment.sql
  -----------------------------------------------------------
  Closes gap G-05: a reservation must keep at least one reserved_kubo row
  (BR-028). PostgreSQL has no declarative "at least one child" rule, so
  this adds deferred constraint triggers that check the invariant at COMMIT.

  The procedures already guarantee it (fn_create_reservation rejects an empty
  assignment list and inserts the header and assignments in one transaction;
  fn_delete_reserved_kubo refuses to remove the last assignment). These triggers
  are the database-level backstop for writes that bypass those procedures.

  Checks, all DEFERRABLE INITIALLY DEFERRED so a header and its assignments can be
  inserted in either order inside one transaction:
  - AFTER INSERT ON kubo.reservation: the new reservation has an assignment.
  - AFTER DELETE ON kubo.reserved_kubo, and AFTER UPDATE OF reservation_id: the
    reservation the row left still has an assignment.

  A reservation that no longer exists at commit is skipped, so the repair-only
  fn_delete_reservation (whose ON DELETE CASCADE removes the assignments) keeps
  working. A violation raises 23514, which the API maps to 400.
*/

DO $$
BEGIN
    IF to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL THEN
        RAISE NOTICE 'Reservation tables are not provisioned; skipping assignment requirement';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE SCHEMA IF NOT EXISTS kubo_reservation_management
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_assert_reservation_has_kubo()
        RETURNS trigger
        LANGUAGE plpgsql
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_reservation_id uuid;
        BEGIN
            IF TG_TABLE_NAME = 'reservation' THEN
                v_reservation_id := NEW.reservation_id;
            ELSE
                v_reservation_id := OLD.reservation_id;
            END IF;

            IF EXISTS (
                SELECT 1
                FROM kubo.reservation AS r
                WHERE r.reservation_id = v_reservation_id
            ) AND NOT EXISTS (
                SELECT 1
                FROM kubo.reserved_kubo AS rk
                WHERE rk.reservation_id = v_reservation_id
            ) THEN
                RAISE EXCEPTION 'A reservation must have at least one kubo assignment.'
                    USING ERRCODE = '23514';
            END IF;

            RETURN NULL;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        DROP TRIGGER IF EXISTS reservation_requires_kubo ON kubo.reservation
    $sql$;

    EXECUTE $sql$
        CREATE CONSTRAINT TRIGGER reservation_requires_kubo
        AFTER INSERT ON kubo.reservation
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        EXECUTE FUNCTION kubo_reservation_management.fn_assert_reservation_has_kubo()
    $sql$;

    EXECUTE $sql$
        DROP TRIGGER IF EXISTS reserved_kubo_keeps_reservation_assigned ON kubo.reserved_kubo
    $sql$;

    EXECUTE $sql$
        CREATE CONSTRAINT TRIGGER reserved_kubo_keeps_reservation_assigned
        AFTER DELETE OR UPDATE OF reservation_id ON kubo.reserved_kubo
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        EXECUTE FUNCTION kubo_reservation_management.fn_assert_reservation_has_kubo()
    $sql$;
END $$;
