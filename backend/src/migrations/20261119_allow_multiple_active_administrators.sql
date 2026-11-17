/*
  Migration: 20261119_allow_multiple_active_administrators.sql
  ------------------------------------------------------------
  Relaxes BR-006 (issue #86). The one-active-Administrator cap made it impossible
  to restore a suspended Administrator while another was active. Several
  Administrators may now be active at once.

  The last-Administrator protection is unchanged: the final active Administrator
  still cannot be suspended, demoted, or deleted.

  Only the cap check is removed from create_employee and
  update_employee_role_status; the rest of both bodies matches
  20261104_wire_identity_audit.sql. Signatures are unchanged.
*/

DO $$
BEGIN
    IF to_regclass('kubo.employee') IS NULL
       OR to_regnamespace('kubo_employee_management') IS NULL THEN
        RAISE NOTICE 'kubo.employee is not provisioned; skipping administrator cap removal';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_employee_management.create_employee(
            p_role_id uuid,
            p_first_name text,
            p_last_name text,
            p_username text,
            p_password_hash text,
            p_status kubo.role_status DEFAULT 'Active',
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS TABLE(
            employee_id uuid,
            role_id uuid,
            first_name character varying,
            last_name character varying,
            username character varying,
            status kubo.role_status,
            created_at timestamp with time zone,
            updated_at timestamp with time zone
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_employee kubo.employee%ROWTYPE;
        BEGIN
            IF p_first_name IS NULL OR btrim(p_first_name) = ''
               OR length(btrim(p_first_name)) > 100
               OR p_last_name IS NULL OR btrim(p_last_name) = ''
               OR length(btrim(p_last_name)) > 100
               OR p_username IS NULL OR btrim(p_username) = ''
               OR length(btrim(p_username)) > 100
               OR p_status IS NULL THEN
                RAISE EXCEPTION 'Valid names, username and status are required.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_password_hash IS NULL
               OR p_password_hash !~ '^\$2[aby]\$(1[2-9]|2[0-9]|3[01])\$[./A-Za-z0-9]{53}$' THEN
                RAISE EXCEPTION 'Supply a bcrypt hash with cost 12 or higher.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.role AS r
            WHERE r.role_id = p_role_id
            FOR KEY SHARE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Employee role does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            INSERT INTO kubo.employee (
                role_id,
                first_name,
                last_name,
                username,
                password_hash,
                status
            )
            VALUES (
                p_role_id,
                btrim(p_first_name),
                btrim(p_last_name),
                btrim(p_username),
                p_password_hash,
                p_status
            )
            RETURNING * INTO v_employee;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Create'::kubo.audit_action,
                'employee',
                v_employee.employee_id,
                format('Created employee %s', v_employee.username),
                NULL,
                kubo_employee_management.fn_employee_audit_json(v_employee.employee_id)
            );

            RETURN QUERY
            SELECT
                v_employee.employee_id,
                v_employee.role_id,
                v_employee.first_name,
                v_employee.last_name,
                v_employee.username,
                v_employee.status,
                v_employee.created_at,
                v_employee.updated_at;
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'Employee username already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_employee_management.update_employee_role_status(
            p_employee_id uuid,
            p_role_id uuid DEFAULT NULL,
            p_first_name text DEFAULT NULL,
            p_last_name text DEFAULT NULL,
            p_username text DEFAULT NULL,
            p_status kubo.role_status DEFAULT NULL,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS TABLE(
            employee_id uuid,
            role_id uuid,
            first_name character varying,
            last_name character varying,
            username character varying,
            status kubo.role_status,
            created_at timestamp with time zone,
            updated_at timestamp with time zone
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_employee kubo.employee%ROWTYPE;
            v_current_role_id uuid;
            v_current_status kubo.role_status;
            v_new_role_id uuid;
            v_new_status kubo.role_status;
            v_current_is_admin boolean;
            v_new_is_admin boolean;
            v_old json;
        BEGIN
            IF p_role_id IS NULL
               AND p_first_name IS NULL
               AND p_last_name IS NULL
               AND p_username IS NULL
               AND p_status IS NULL THEN
                RAISE EXCEPTION 'Supply at least one field to update.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_first_name IS NOT NULL
               AND (btrim(p_first_name) = '' OR length(btrim(p_first_name)) > 100) THEN
                RAISE EXCEPTION 'First name must be between 1 and 100 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_last_name IS NOT NULL
               AND (btrim(p_last_name) = '' OR length(btrim(p_last_name)) > 100) THEN
                RAISE EXCEPTION 'Last name must be between 1 and 100 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_username IS NOT NULL
               AND (btrim(p_username) = '' OR length(btrim(p_username)) > 100) THEN
                RAISE EXCEPTION 'Username must be between 1 and 100 characters.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.employee AS e
            WHERE e.employee_id = p_employee_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Employee does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT e.role_id, e.status
            INTO v_current_role_id, v_current_status
            FROM kubo.employee AS e
            WHERE e.employee_id = p_employee_id;

            IF p_role_id IS NOT NULL THEN
                PERFORM 1
                FROM kubo.role AS r
                WHERE r.role_id = p_role_id
                FOR KEY SHARE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Replacement role does not exist.'
                        USING ERRCODE = 'P0002';
                END IF;
            END IF;

            v_new_role_id := COALESCE(p_role_id, v_current_role_id);
            v_new_status := COALESCE(p_status, v_current_status);
            v_current_is_admin :=
                v_current_status = 'Active'
                AND kubo_employee_management.is_administrator_role(v_current_role_id);
            v_new_is_admin :=
                v_new_status = 'Active'
                AND kubo_employee_management.is_administrator_role(v_new_role_id);

            IF v_current_is_admin AND NOT v_new_is_admin THEN
                IF NOT EXISTS (
                    SELECT 1
                    FROM kubo.employee AS e
                    WHERE e.employee_id <> p_employee_id
                      AND e.status = 'Active'
                      AND kubo_employee_management.is_administrator_role(e.role_id)
                ) THEN
                    RAISE EXCEPTION 'The last active Administrator cannot be deactivated or reassigned.'
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            v_old := kubo_employee_management.fn_employee_audit_json(p_employee_id);

            UPDATE kubo.employee AS e
            SET
                role_id = COALESCE(p_role_id, e.role_id),
                first_name = COALESCE(NULLIF(btrim(p_first_name), ''), e.first_name),
                last_name = COALESCE(NULLIF(btrim(p_last_name), ''), e.last_name),
                username = COALESCE(NULLIF(btrim(p_username), ''), e.username),
                status = COALESCE(p_status, e.status),
                updated_at = clock_timestamp()
            WHERE e.employee_id = p_employee_id
            RETURNING * INTO v_employee;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'employee',
                p_employee_id,
                format('Updated employee %s', v_employee.username),
                v_old,
                kubo_employee_management.fn_employee_audit_json(p_employee_id)
            );

            RETURN QUERY
            SELECT
                v_employee.employee_id,
                v_employee.role_id,
                v_employee.first_name,
                v_employee.last_name,
                v_employee.username,
                v_employee.status,
                v_employee.created_at,
                v_employee.updated_at;
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'Employee username already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;

END $$;
