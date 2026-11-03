/*
  Migration: 20261031_add_audit_history_query.sql
  -----------------------------------------------
  Adds a focused audit-history query for a single entity.

  Unlike search_audit_logs(...), which supports broad filters, this function is
  intended for histories such as "all audit records for employee X" or
  "all audit records for role Y".
*/

DO $$
BEGIN
    IF to_regclass('kubo.audit_log') IS NULL THEN
        RAISE NOTICE 'kubo.audit_log is not provisioned; skipping audit history query';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo.get_audit_history(
            p_entity_type character varying,
            p_entity_id uuid,
            p_limit integer DEFAULT 10,
            p_offset integer DEFAULT 0
        )
        RETURNS SETOF kubo.audit_log
        LANGUAGE plpgsql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        BEGIN
            IF p_entity_type IS NULL OR btrim(p_entity_type) = '' THEN
                RAISE EXCEPTION 'Audit entity type is required.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_entity_id IS NULL THEN
                RAISE EXCEPTION 'Audit entity ID is required.'
                    USING ERRCODE = '22023';
            END IF;

            RETURN QUERY
            SELECT *
            FROM kubo.audit_log AS a
            WHERE lower(a.entity_type) = lower(btrim(p_entity_type))
              AND a.entity_id = p_entity_id
            ORDER BY a.created_at DESC, a.audit_id DESC
            LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100)
            OFFSET GREATEST(COALESCE(p_offset, 0), 0);
        END;
        $function$
    $sql$;
END $$;
