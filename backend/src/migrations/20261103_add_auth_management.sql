/*
  Migration: 20261103_add_auth_management.sql
  -------------------------------------------------
  Adds the authentication routines used by the JWT auth module.

  Included:
  - get_login_credentials(username): the minimal employee + role + password
    hash needed to verify a sign-in. Only consumed by the auth service; the
    hash is never returned by the API.
  - get_authenticated_employee(employee_id): a safe employee + role profile
    (no password hash) used to refresh identity on every protected request and
    by GET /auth/me.

  Both routines are SECURITY DEFINER with a hardened search path, matching the
  existing role/employee/payment/additional-charge migrations.
*/

DO $$
BEGIN
    IF to_regclass('kubo.employee') IS NULL
       OR to_regclass('kubo.role') IS NULL
       OR to_regtype('kubo.role_status') IS NULL THEN
        RAISE NOTICE 'Employee/role schema is not provisioned; skipping auth management SQL';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE SCHEMA IF NOT EXISTS kubo_auth_management
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_auth_management.get_login_credentials(
            p_username character varying
        )
        RETURNS TABLE(
            employee_id uuid,
            role_id uuid,
            role_name character varying,
            first_name character varying,
            last_name character varying,
            username character varying,
            status kubo.role_status,
            password_hash character varying
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            e.employee_id,
            e.role_id,
            r.role_name,
            e.first_name,
            e.last_name,
            e.username,
            e.status,
            e.password_hash
        FROM kubo.employee AS e
        JOIN kubo.role AS r ON r.role_id = e.role_id
        WHERE e.username = btrim(p_username);
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_auth_management.get_authenticated_employee(
            p_employee_id uuid
        )
        RETURNS TABLE(
            employee_id uuid,
            role_id uuid,
            role_name character varying,
            first_name character varying,
            last_name character varying,
            username character varying,
            status kubo.role_status
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            e.employee_id,
            e.role_id,
            r.role_name,
            e.first_name,
            e.last_name,
            e.username,
            e.status
        FROM kubo.employee AS e
        JOIN kubo.role AS r ON r.role_id = e.role_id
        WHERE e.employee_id = p_employee_id;
        $function$
    $sql$;
END
$$;
