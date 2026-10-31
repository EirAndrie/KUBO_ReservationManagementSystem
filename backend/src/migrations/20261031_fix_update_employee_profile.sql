/*
  Migration: 20261031_fix_update_employee_profile.sql
  -------------------------------------------------
  Repairs the employee update routine used by the employee module.

  `update_employee_role_status` previously accepted only the employee, role and
  status arguments even though its body also referenced `p_first_name`,
  `p_last_name` and `p_username`. Any call to it failed with either "function
  does not exist" (when the caller supplied the profile arguments) or
  "column does not exist" (when the caller supplied only the original
  arguments).

  The routine is recreated as a function that accepts the full update payload
  and returns the updated `kubo.employee` row so the repository can consume it
  with a single `SELECT * FROM ...` call.

  The guard keeps this migration safe for databases where the employee schema
  has not been provisioned yet (only the role schema currently ships in this
  repository).
*/

DO $$
BEGIN
    IF to_regclass('kubo.employee') IS NULL
       OR to_regtype('kubo.role_status') IS NULL
       OR to_regnamespace('kubo_employee_management') IS NULL THEN
        RAISE NOTICE 'kubo.employee is not provisioned; skipping employee update routine repair';
        RETURN;
    END IF;

    EXECUTE $drop$
        DROP ROUTINE IF EXISTS kubo_employee_management.update_employee_role_status(
            uuid,
            uuid,
            kubo.role_status
        )
    $drop$;

    EXECUTE $fn$
        CREATE OR REPLACE FUNCTION kubo_employee_management.update_employee_role_status(
            p_employee_id uuid,
            p_role_id uuid DEFAULT NULL,
            p_first_name text DEFAULT NULL,
            p_last_name text DEFAULT NULL,
            p_username text DEFAULT NULL,
            p_status kubo.role_status DEFAULT NULL
        )
        RETURNS kubo.employee
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_employee kubo.employee%ROWTYPE;
        BEGIN
            IF p_role_id IS NULL
               AND p_first_name IS NULL
               AND p_last_name IS NULL
               AND p_username IS NULL
               AND p_status IS NULL THEN
                RAISE EXCEPTION 'Supply at least one field to update.'
                    USING ERRCODE = '22023';
            END IF;

            -- Lock the employee record for the duration of the update.
            PERFORM 1
            FROM kubo.employee
            WHERE employee_id = p_employee_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Employee does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            -- Validate the replacement role before updating.
            IF p_role_id IS NOT NULL THEN
                PERFORM 1
                FROM kubo.role
                WHERE role_id = p_role_id
                FOR KEY SHARE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Replacement role does not exist.'
                        USING ERRCODE = 'P0002';
                END IF;
            END IF;

            UPDATE kubo.employee
            SET
                role_id = COALESCE(p_role_id, role_id),
                first_name = COALESCE(p_first_name, first_name),
                last_name = COALESCE(p_last_name, last_name),
                username = COALESCE(p_username, username),
                status = COALESCE(p_status, status),
                updated_at = clock_timestamp()
            WHERE employee_id = p_employee_id
            RETURNING * INTO v_employee;

            RETURN v_employee;
        END;
        $function$
    $fn$;
END $$;
