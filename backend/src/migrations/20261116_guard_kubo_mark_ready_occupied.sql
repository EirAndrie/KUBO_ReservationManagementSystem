/*
  Migration: 20261116_guard_kubo_mark_ready_occupied.sql
  ------------------------------------------------------
  Follow-up to 20261116_add_kubo_mark_ready.sql (code review).

  Problem fixed:
  - fn_mark_kubo_ready only checked that the kubo was Cleaning. An
    Administrator can move an Occupied kubo to Cleaning with the general status
    route while a guest is still checked in; Staff could then mark it ready, and
    the Available kubo could be booked while the guest is in it.

  Changed: kubo_management.fn_mark_kubo_ready(p_kubo_id, p_actor_employee_id)
  Same signature, return shape, and audit row. It now also refuses (23514) when
  any reserved_kubo row for the kubo is still CheckedIn.
*/

DO $$
BEGIN
    IF to_regclass('kubo.kubo') IS NULL
       OR to_regclass('kubo.kubo_type') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL
       OR to_regclass('kubo.audit_log') IS NULL
       OR to_regprocedure('kubo_management.fn_kubo_audit_json(uuid)') IS NULL THEN
        RAISE NOTICE 'Kubo or audit routines are not provisioned; skipping fn_mark_kubo_ready guard';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_management.fn_mark_kubo_ready(
            p_kubo_id uuid,
            p_actor_employee_id uuid
        )
        RETURNS TABLE(
            kubo_id uuid,
            kubo_number character varying,
            kubo_type_id uuid,
            type_name character varying,
            capacity integer,
            price_per_night numeric,
            status kubo.kubo_status
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_current kubo.kubo%ROWTYPE;
            v_old json;
        BEGIN
            IF p_actor_employee_id IS NULL THEN
                RAISE EXCEPTION 'An acting employee is required.'
                    USING ERRCODE = '22023';
            END IF;

            SELECT k.* INTO v_current
            FROM kubo.kubo AS k
            WHERE k.kubo_id = p_kubo_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Kubo does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_current.status <> 'Cleaning' THEN
                RAISE EXCEPTION 'Only a kubo in Cleaning can be marked ready. Kubo % is %.',
                    v_current.kubo_number, v_current.status
                    USING ERRCODE = '23514';
            END IF;

            IF EXISTS (
                SELECT 1
                FROM kubo.reserved_kubo AS rk
                WHERE rk.kubo_id = p_kubo_id
                  AND rk.status = 'CheckedIn'
            ) THEN
                RAISE EXCEPTION 'Kubo % still has a checked-in guest. Check the guest out before marking it ready.',
                    v_current.kubo_number
                    USING ERRCODE = '23514';
            END IF;

            v_old := kubo_management.fn_kubo_audit_json(p_kubo_id);

            UPDATE kubo.kubo AS k
            SET status = 'Available'
            WHERE k.kubo_id = p_kubo_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'kubo',
                p_kubo_id,
                format('Marked kubo %s ready (Cleaning to Available)', v_current.kubo_number),
                v_old,
                kubo_management.fn_kubo_audit_json(p_kubo_id)
            );

            RETURN QUERY
            SELECT
                k.kubo_id,
                k.kubo_number,
                k.kubo_type_id,
                t.type_name,
                t.capacity,
                t.price_per_night,
                k.status
            FROM kubo.kubo AS k
            JOIN kubo.kubo_type AS t ON t.kubo_type_id = k.kubo_type_id
            WHERE k.kubo_id = p_kubo_id;
        END;
        $function$
    $sql$;
END $$;
