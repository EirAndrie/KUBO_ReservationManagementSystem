/*
  Migration: 20261104_wire_identity_audit.sql
  -------------------------------------------
  Wires audit-log writes into role and employee mutations (BR-067, BR-068,
  BR-070, BR-071).

  - Adds an acting-employee parameter to role and employee mutations.
  - Each mutation writes one audit row inside the same transaction.
  - Employee audit values are built with an explicit safe JSON helper that
    never includes password_hash (BR-070).
  - Deletes write their audit row before the delete so the actor still
    resolves even when the target is the actor.
*/

DO $$
BEGIN
    IF to_regclass('kubo.audit_log') IS NULL
       OR to_regclass('kubo.role') IS NULL
       OR to_regclass('kubo.employee') IS NULL
       OR to_regnamespace('kubo_role_management') IS NULL
       OR to_regnamespace('kubo_employee_management') IS NULL THEN
        RAISE NOTICE 'kubo.role/employee or audit_log is not provisioned; skipping identity audit wiring';
        RETURN;
    END IF;

    -------------------------------------------------------------------------
    -- Shared safe employee snapshot (excludes password_hash)
    -------------------------------------------------------------------------

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_employee_management.fn_employee_audit_json(
            p_employee_id uuid
        )
        RETURNS json
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT json_build_object(
            'employee_id', e.employee_id,
            'role_id', e.role_id,
            'first_name', e.first_name,
            'last_name', e.last_name,
            'username', e.username,
            'status', e.status,
            'created_at', e.created_at,
            'updated_at', e.updated_at
        )
        FROM kubo.employee AS e
        WHERE e.employee_id = p_employee_id;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Role: create_role
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_role_management.create_role(text, text)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_role_management.create_role(
            p_name text,
            p_desc text,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS kubo.role
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_role kubo.role%ROWTYPE;
            v_name text := btrim(p_name);
        BEGIN
            IF v_name IS NULL OR v_name = '' OR length(v_name) > 50 THEN
                RAISE EXCEPTION 'Role name must be between 1 and 50 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_desc IS NOT NULL AND length(btrim(p_desc)) > 255 THEN
                RAISE EXCEPTION 'Role description cannot exceed 255 characters.'
                    USING ERRCODE = '22023';
            END IF;

            INSERT INTO kubo.role (role_name, description)
            VALUES (v_name, NULLIF(btrim(p_desc), ''))
            RETURNING * INTO v_role;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Create'::kubo.audit_action,
                'role',
                v_role.role_id,
                format('Created role %s', v_name),
                NULL,
                json_build_object(
                    'role_id', v_role.role_id,
                    'role_name', v_role.role_name,
                    'description', v_role.description
                )
            );

            RETURN v_role;
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'Role name already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Role: update_role
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_role_management.update_role(uuid, text, text)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_role_management.update_role(
            p_id uuid,
            p_name text,
            p_desc text,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS kubo.role
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_role kubo.role%ROWTYPE;
            v_name text := NULLIF(btrim(p_name), '');
            v_desc text := NULLIF(btrim(p_desc), '');
            v_old json;
        BEGIN
            IF p_name IS NOT NULL AND v_name IS NULL THEN
                RAISE EXCEPTION 'Role name cannot be blank.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_name IS NOT NULL AND length(v_name) > 50 THEN
                RAISE EXCEPTION 'Role name must be between 1 and 50 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_desc IS NOT NULL AND length(v_desc) > 255 THEN
                RAISE EXCEPTION 'Role description cannot exceed 255 characters.'
                    USING ERRCODE = '22023';
            END IF;

            SELECT json_build_object(
                'role_id', r.role_id,
                'role_name', r.role_name,
                'description', r.description
            )
            INTO v_old
            FROM kubo.role AS r
            WHERE r.role_id = p_id;

            UPDATE kubo.role
               SET role_name = COALESCE(v_name, role_name),
                   description = COALESCE(v_desc, description)
             WHERE role_id = p_id
             RETURNING * INTO v_role;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'role',
                p_id,
                format('Updated role %s', v_role.role_name),
                v_old,
                json_build_object(
                    'role_id', v_role.role_id,
                    'role_name', v_role.role_name,
                    'description', v_role.description
                )
            );

            RETURN v_role;
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'Role name already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Role: delete_unused_role
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_role_management.delete_unused_role(uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_role_management.delete_unused_role(
            p_id uuid,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_old json;
        BEGIN
            PERFORM 1
            FROM kubo.role
            WHERE role_id = p_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RETURN FALSE;
            END IF;

            IF EXISTS (
                SELECT 1
                FROM kubo.employee
                WHERE role_id = p_id
            ) THEN
                RAISE EXCEPTION 'Role is assigned to employees and cannot be deleted.'
                    USING ERRCODE = '23503';
            END IF;

            SELECT json_build_object(
                'role_id', r.role_id,
                'role_name', r.role_name,
                'description', r.description
            )
            INTO v_old
            FROM kubo.role AS r
            WHERE r.role_id = p_id;

            DELETE FROM kubo.role WHERE role_id = p_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Delete'::kubo.audit_action,
                'role',
                p_id,
                format('Deleted role %s', v_old->>'role_name'),
                v_old,
                NULL
            );

            RETURN TRUE;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Employee: create_employee
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_employee_management.create_employee(uuid, text, text, text, text, kubo.role_status)
    $sql$;

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

            IF p_status = 'Active'
               AND kubo_employee_management.is_administrator_role(p_role_id)
               AND EXISTS (
                    SELECT 1
                    FROM kubo.employee AS e
                    WHERE e.status = 'Active'
                      AND kubo_employee_management.is_administrator_role(e.role_id)
               ) THEN
                RAISE EXCEPTION 'At most one active Administrator is allowed.'
                    USING ERRCODE = '23514';
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

    -------------------------------------------------------------------------
    -- Employee: update_employee_role_status
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_employee_management.update_employee_role_status(uuid, uuid, text, text, text, kubo.role_status)
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

            IF v_new_is_admin AND NOT v_current_is_admin THEN
                IF EXISTS (
                    SELECT 1
                    FROM kubo.employee AS e
                    WHERE e.employee_id <> p_employee_id
                      AND e.status = 'Active'
                      AND kubo_employee_management.is_administrator_role(e.role_id)
                ) THEN
                    RAISE EXCEPTION 'At most one active Administrator is allowed.'
                        USING ERRCODE = '23514';
                END IF;
            ELSIF v_current_is_admin AND NOT v_new_is_admin THEN
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

    -------------------------------------------------------------------------
    -- Employee: delete_unused_employee
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_employee_management.delete_unused_employee(uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_employee_management.delete_unused_employee(
            p_employee_id uuid,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_role_id uuid;
            v_status kubo.role_status;
            v_old json;
        BEGIN
            PERFORM 1
            FROM kubo.employee
            WHERE employee_id = p_employee_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RETURN FALSE;
            END IF;

            SELECT e.role_id, e.status
            INTO v_role_id, v_status
            FROM kubo.employee AS e
            WHERE e.employee_id = p_employee_id;

            IF v_status = 'Active'
               AND kubo_employee_management.is_administrator_role(v_role_id)
               AND NOT EXISTS (
                    SELECT 1
                    FROM kubo.employee AS e
                    WHERE e.employee_id <> p_employee_id
                      AND e.status = 'Active'
                      AND kubo_employee_management.is_administrator_role(e.role_id)
               ) THEN
                RAISE EXCEPTION 'The last active Administrator cannot be deleted.'
                    USING ERRCODE = '23514';
            END IF;

            IF EXISTS (
                SELECT 1 FROM kubo.reservation WHERE employee_id = p_employee_id
            ) OR EXISTS (
                SELECT 1 FROM kubo.payment WHERE employee_id = p_employee_id
            ) OR EXISTS (
                SELECT 1 FROM kubo.additional_charge WHERE employee_id = p_employee_id
            ) OR EXISTS (
                SELECT 1 FROM kubo.audit_log WHERE employee_id = p_employee_id
            ) THEN
                RAISE EXCEPTION 'Employee has history; retain the record.'
                    USING ERRCODE = '23503';
            END IF;

            v_old := kubo_employee_management.fn_employee_audit_json(p_employee_id);

            DELETE FROM kubo.employee WHERE employee_id = p_employee_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Delete'::kubo.audit_action,
                'employee',
                p_employee_id,
                format('Deleted employee %s', v_old->>'username'),
                v_old,
                NULL
            );

            RETURN TRUE;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Employee: reset_employee_password
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_employee_management.reset_employee_password(uuid, text)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_employee_management.reset_employee_password(
            p_employee_id uuid,
            p_password_hash text,
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
            IF p_password_hash IS NULL
               OR p_password_hash !~ '^\$2[aby]\$(1[2-9]|2[0-9]|3[01])\$[./A-Za-z0-9]{53}$' THEN
                RAISE EXCEPTION 'Supply a bcrypt hash with cost 12 or higher.'
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

            UPDATE kubo.employee AS e
            SET password_hash = p_password_hash,
                updated_at = clock_timestamp()
            WHERE e.employee_id = p_employee_id
            RETURNING * INTO v_employee;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'employee',
                p_employee_id,
                format('Reset password for employee %s', v_employee.username),
                kubo_employee_management.fn_employee_audit_json(p_employee_id),
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
        END;
        $function$
    $sql$;

END $$;
