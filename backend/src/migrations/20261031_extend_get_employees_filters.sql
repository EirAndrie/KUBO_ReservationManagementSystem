/*
  Migration: 20261031_extend_get_employees_filters.sql
  ---------------------------------------------------
  Extends the employee listing function with the filters used by the employee
  module: role, status, free-text search and pagination.

  `role` accepts either an employee role UUID or a role name (case-insensitive).
  `status` must be a value of `kubo.role_status`. `search` matches the employee's
  first name, last name or username. The database caps the page size at 100.

  The old one-argument `(kubo.role_status)` signature is dropped so that the
  defaulted `get_employees()` call cannot resolve to two overloads.
*/

DO $$
BEGIN
    IF to_regclass('kubo.employee') IS NULL
       OR to_regtype('kubo.role_status') IS NULL
       OR to_regnamespace('kubo_employee_management') IS NULL THEN
        RAISE NOTICE 'kubo.employee is not provisioned; skipping employee listing function update';
        RETURN;
    END IF;

    EXECUTE $drop$
        DROP FUNCTION IF EXISTS kubo_employee_management.get_employees(kubo.role_status)
    $drop$;

    EXECUTE $fn$
        CREATE OR REPLACE FUNCTION kubo_employee_management.get_employees(
            p_role text DEFAULT NULL,
            p_status kubo.role_status DEFAULT NULL,
            p_search text DEFAULT NULL,
            p_limit integer DEFAULT 10,
            p_offset integer DEFAULT 0
        )
        RETURNS TABLE(
            employee_id uuid,
            first_name character varying,
            last_name character varying,
            username character varying,
            role_id uuid,
            role_name character varying,
            status kubo.role_status,
            created_at timestamp with time zone,
            updated_at timestamp with time zone
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            e.employee_id,
            e.first_name,
            e.last_name,
            e.username,
            e.role_id,
            r.role_name,
            e.status,
            e.created_at,
            e.updated_at
        FROM kubo.employee AS e
        JOIN kubo.role AS r ON r.role_id = e.role_id
        WHERE (
                p_role IS NULL
                OR btrim(p_role) = ''
                OR lower(r.role_name) = lower(btrim(p_role))
                OR e.role_id::text ILIKE btrim(p_role)
            )
          AND (p_status IS NULL OR e.status = p_status)
          AND (
                p_search IS NULL
                OR btrim(p_search) = ''
                OR e.first_name ILIKE '%' || btrim(p_search) || '%'
                OR e.last_name ILIKE '%' || btrim(p_search) || '%'
                OR e.username ILIKE '%' || btrim(p_search) || '%'
            )
        ORDER BY e.last_name, e.first_name, e.employee_id
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100)
        OFFSET GREATEST(COALESCE(p_offset, 0), 0)
        $function$
    $fn$;
END $$;
