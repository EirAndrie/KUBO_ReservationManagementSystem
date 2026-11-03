/*
  Migration: 20261031_add_audit_management_sql.sql
  ------------------------------------------------
  Adds the missing audit-log database surface:

  - write_audit_log(...) for role/employee (and future module) mutations.
  - get_audit_log_by_id(...) used by the audit-log module.
  - search_audit_logs(...) used by the audit-log module.
  - append-only protection for kubo.audit_log (BR-069).

  The write routine requires a real acting employee ID. Role and employee
  mutations are not wired to it yet because authentication/RBAC is not
  implemented; passing a client-supplied actor would be unsafe.
*/

DO $$
BEGIN
    IF to_regclass('kubo.audit_log') IS NULL
       OR to_regtype('kubo.audit_action') IS NULL THEN
        RAISE NOTICE 'kubo.audit_log is not provisioned; skipping audit management SQL';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE SCHEMA IF NOT EXISTS kubo_audit_management
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_audit_management.write_audit_log(
            p_employee_id uuid,
            p_action kubo.audit_action,
            p_entity_type character varying,
            p_entity_id uuid,
            p_description text DEFAULT NULL,
            p_old_values json DEFAULT NULL,
            p_new_values json DEFAULT NULL
        )
        RETURNS kubo.audit_log
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_log kubo.audit_log%ROWTYPE;
        BEGIN
            IF p_employee_id IS NULL OR p_entity_id IS NULL THEN
                RAISE EXCEPTION 'Audit actor and entity IDs are required.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_entity_type IS NULL OR btrim(p_entity_type) = '' THEN
                RAISE EXCEPTION 'Audit entity type is required.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.employee
            WHERE employee_id = p_employee_id
            FOR KEY SHARE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Audit actor does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            INSERT INTO kubo.audit_log (
                employee_id,
                action,
                entity_type,
                entity_id,
                description,
                old_values,
                new_values
            )
            VALUES (
                p_employee_id,
                p_action,
                btrim(p_entity_type),
                p_entity_id,
                p_description,
                p_old_values,
                p_new_values
            )
            RETURNING * INTO v_log;

            RETURN v_log;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo.get_audit_log_by_id(p_audit_id uuid)
        RETURNS SETOF kubo.audit_log
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT *
        FROM kubo.audit_log
        WHERE audit_id = p_audit_id;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo.search_audit_logs(
            p_employee_id uuid DEFAULT NULL,
            p_action text DEFAULT NULL,
            p_entity_type character varying DEFAULT NULL,
            p_entity_id uuid DEFAULT NULL,
            p_created_from timestamp with time zone DEFAULT NULL,
            p_created_to timestamp with time zone DEFAULT NULL,
            p_limit integer DEFAULT 10,
            p_offset integer DEFAULT 0
        )
        RETURNS SETOF kubo.audit_log
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT *
        FROM kubo.audit_log AS a
        WHERE (p_employee_id IS NULL OR a.employee_id = p_employee_id)
          AND (
                p_action IS NULL
                OR btrim(p_action) = ''
                OR lower(a.action::text) = lower(btrim(p_action))
            )
          AND (
                p_entity_type IS NULL
                OR btrim(p_entity_type) = ''
                OR lower(a.entity_type) = lower(btrim(p_entity_type))
            )
          AND (p_entity_id IS NULL OR a.entity_id = p_entity_id)
          AND (p_created_from IS NULL OR a.created_at >= p_created_from)
          AND (p_created_to IS NULL OR a.created_at <= p_created_to)
        ORDER BY a.created_at DESC, a.audit_id DESC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100)
        OFFSET GREATEST(COALESCE(p_offset, 0), 0);
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_audit_management.prevent_audit_mutation()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        BEGIN
            RAISE EXCEPTION 'Audit log records are append-only.'
                USING ERRCODE = '42501';
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        DROP TRIGGER IF EXISTS audit_log_append_only ON kubo.audit_log
    $sql$;

    EXECUTE $sql$
        CREATE TRIGGER audit_log_append_only
        BEFORE UPDATE OR DELETE ON kubo.audit_log
        FOR EACH ROW
        EXECUTE FUNCTION kubo_audit_management.prevent_audit_mutation()
    $sql$;

    EXECUTE $sql$
        DROP TRIGGER IF EXISTS audit_log_no_truncate ON kubo.audit_log
    $sql$;

    EXECUTE $sql$
        CREATE TRIGGER audit_log_no_truncate
        BEFORE TRUNCATE ON kubo.audit_log
        FOR EACH STATEMENT
        EXECUTE FUNCTION kubo_audit_management.prevent_audit_mutation()
    $sql$;
END $$;
