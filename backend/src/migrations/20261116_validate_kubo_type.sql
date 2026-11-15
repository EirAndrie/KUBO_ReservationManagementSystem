/*
  Migration: 20261116_validate_kubo_type.sql
  -------------------------------------------------
  Kubo types must have a positive nightly rate and a readable name.

  Rule:
  - price_per_night > 0 (00.01 is the smallest value with two decimals);
  - type_name contains at least two letters and only letters, digits, spaces,
    and common punctuation. Numeric-only names such as 123123, identifier-like
    values with underscores, and symbol-only values are rejected.

  The two constraints are NOT VALID so existing rows are left untouched; every
  new INSERT or UPDATE is checked. The stored functions also return friendly
  messages, while Zod and the Admin drawer validate first and show inline errors.
*/

DO $$
BEGIN
    IF to_regclass('kubo.kubo_type') IS NULL
       OR to_regprocedure('kubo_kubo_type_management.fn_create_kubo_type(character varying, integer, numeric, character varying, uuid)') IS NULL
       OR to_regprocedure('kubo_kubo_type_management.fn_update_kubo_type(uuid, character varying, integer, numeric, character varying, uuid)') IS NULL THEN
        RAISE NOTICE 'Kubo type dependencies are not provisioned; skipping kubo type validation';
        RETURN;
    END IF;

    -------------------------------------------------------------------------
    -- Database backstops.
    -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'kubo_type_price_positive_check'
          AND conrelid = 'kubo.kubo_type'::regclass
    ) THEN
        ALTER TABLE kubo.kubo_type
            ADD CONSTRAINT kubo_type_price_positive_check
            CHECK (price_per_night > 0)
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'kubo_type_name_check'
          AND conrelid = 'kubo.kubo_type'::regclass
    ) THEN
        ALTER TABLE kubo.kubo_type
            ADD CONSTRAINT kubo_type_name_check
            CHECK (
                length(btrim(type_name)) >= 1
                AND type_name ~ '^[[:alpha:]0-9 ''’.,&/()+%-]+$'
                AND length(regexp_replace(type_name, '[^[:alpha:]]', '', 'g')) >= 2
            )
            NOT VALID;
    END IF;

    -------------------------------------------------------------------------
    -- Kubo type creation.
    -------------------------------------------------------------------------
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_kubo_type_management.fn_create_kubo_type(
            p_type_name character varying,
            p_capacity integer,
            p_price_per_night numeric,
            p_description character varying DEFAULT NULL,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS TABLE(
            kubo_type_id uuid,
            type_name character varying,
            capacity integer,
            price_per_night numeric,
            description character varying
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_name text := NULLIF(btrim(p_type_name), '');
            v_desc text := NULLIF(btrim(p_description), '');
            v_type kubo.kubo_type%ROWTYPE;
        BEGIN
            IF v_name IS NULL OR length(v_name) > 100 THEN
                RAISE EXCEPTION 'Kubo type name must be between 1 and 100 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_name !~ '^[[:alpha:]0-9 ''’.,&/()+%-]+$'
               OR length(regexp_replace(v_name, '[^[:alpha:]]', '', 'g')) < 2 THEN
                RAISE EXCEPTION 'Kubo type name must include at least two letters and use only letters, numbers, spaces, and common punctuation.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_capacity IS NULL OR p_capacity <= 0 THEN
                RAISE EXCEPTION 'Capacity must be greater than zero.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_price_per_night IS NULL OR p_price_per_night <= 0 THEN
                RAISE EXCEPTION 'Price per night must be greater than zero.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_price_per_night <> round(p_price_per_night, 2) THEN
                RAISE EXCEPTION 'Price per night cannot have more than two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_desc IS NOT NULL AND length(v_desc) > 255 THEN
                RAISE EXCEPTION 'Kubo type description cannot exceed 255 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF EXISTS (
                SELECT 1
                FROM kubo.kubo_type AS kt
                WHERE lower(kt.type_name) = lower(v_name)
            ) THEN
                RAISE EXCEPTION 'Kubo type name already exists.'
                    USING ERRCODE = '23505';
            END IF;

            INSERT INTO kubo.kubo_type (
                type_name,
                capacity,
                price_per_night,
                description
            )
            VALUES (
                v_name,
                p_capacity,
                p_price_per_night,
                v_desc
            )
            RETURNING * INTO v_type;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Create'::kubo.audit_action,
                'kubo_type',
                v_type.kubo_type_id,
                format('Created kubo type %s', v_name),
                NULL,
                kubo_kubo_type_management.fn_kubo_type_audit_json(v_type.kubo_type_id)
            );

            RETURN QUERY
            SELECT
                kt.kubo_type_id,
                kt.type_name,
                kt.capacity,
                kt.price_per_night,
                kt.description
            FROM kubo.kubo_type AS kt
            WHERE kt.kubo_type_id = v_type.kubo_type_id;
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'Kubo type name already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Kubo type update.
    -------------------------------------------------------------------------
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_kubo_type_management.fn_update_kubo_type(
            p_kubo_type_id uuid,
            p_type_name character varying DEFAULT NULL,
            p_capacity integer DEFAULT NULL,
            p_price_per_night numeric DEFAULT NULL,
            p_description character varying DEFAULT NULL,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS TABLE(
            kubo_type_id uuid,
            type_name character varying,
            capacity integer,
            price_per_night numeric,
            description character varying
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_name text := NULLIF(btrim(p_type_name), '');
            v_desc text := NULLIF(btrim(p_description), '');
            v_type kubo.kubo_type%ROWTYPE;
            v_old json;
        BEGIN
            IF p_type_name IS NULL
               AND p_capacity IS NULL
               AND p_price_per_night IS NULL
               AND p_description IS NULL THEN
                RAISE EXCEPTION 'Provide at least one field to update.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_type_name IS NOT NULL
               AND (v_name IS NULL OR length(v_name) > 100) THEN
                RAISE EXCEPTION 'Kubo type name must be between 1 and 100 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_type_name IS NOT NULL
               AND (
                    v_name !~ '^[[:alpha:]0-9 ''’.,&/()+%-]+$'
                    OR length(regexp_replace(v_name, '[^[:alpha:]]', '', 'g')) < 2
               ) THEN
                RAISE EXCEPTION 'Kubo type name must include at least two letters and use only letters, numbers, spaces, and common punctuation.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_capacity IS NOT NULL AND p_capacity <= 0 THEN
                RAISE EXCEPTION 'Capacity must be greater than zero.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_price_per_night IS NOT NULL AND p_price_per_night <= 0 THEN
                RAISE EXCEPTION 'Price per night must be greater than zero.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_price_per_night IS NOT NULL
               AND p_price_per_night <> round(p_price_per_night, 2) THEN
                RAISE EXCEPTION 'Price per night cannot have more than two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_description IS NOT NULL
               AND v_desc IS NOT NULL
               AND length(v_desc) > 255 THEN
                RAISE EXCEPTION 'Kubo type description cannot exceed 255 characters.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.kubo_type AS kt
            WHERE kt.kubo_type_id = p_kubo_type_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Kubo type does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_name IS NOT NULL AND EXISTS (
                SELECT 1
                FROM kubo.kubo_type AS kt
                WHERE lower(kt.type_name) = lower(v_name)
                  AND kt.kubo_type_id <> p_kubo_type_id
            ) THEN
                RAISE EXCEPTION 'Kubo type name already exists.'
                    USING ERRCODE = '23505';
            END IF;

            v_old := kubo_kubo_type_management.fn_kubo_type_audit_json(p_kubo_type_id);

            UPDATE kubo.kubo_type AS kt
            SET
                type_name = COALESCE(v_name, kt.type_name),
                capacity = COALESCE(p_capacity, kt.capacity),
                price_per_night = COALESCE(p_price_per_night, kt.price_per_night),
                description = CASE
                    WHEN p_description IS NULL THEN kt.description
                    ELSE v_desc
                END
            WHERE kt.kubo_type_id = p_kubo_type_id
            RETURNING * INTO v_type;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'kubo_type',
                p_kubo_type_id,
                format('Updated kubo type %s', v_type.type_name),
                v_old,
                kubo_kubo_type_management.fn_kubo_type_audit_json(p_kubo_type_id)
            );

            RETURN QUERY
            SELECT
                kt.kubo_type_id,
                kt.type_name,
                kt.capacity,
                kt.price_per_night,
                kt.description
            FROM kubo.kubo_type AS kt
            WHERE kt.kubo_type_id = v_type.kubo_type_id;
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'Kubo type name already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;
END;
$$;
