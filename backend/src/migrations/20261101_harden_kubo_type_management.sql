/*
  Migration: 20261101_harden_kubo_type_management.sql
  ---------------------------------------------------
  Adds the kubo-type routines required by the module and business rules.

  Included:
  - Case-insensitive unique type names.
  - Validated create/update with length and decimal precision checks.
  - Paginated list/search with capacity filters.
  - Safe lookup by ID.
  - Reference-safe deletion. A type with kubos cannot be deleted; the caller is
    told to set those kubos OutOfService instead.
  - Updating price_per_night never touches reserved_kubo.price_at_booking.

  Audit writes are intentionally deferred until authentication provides a
  trusted acting employee.
*/

DO $$
BEGIN
    IF to_regclass('kubo.kubo_type') IS NULL
       OR to_regclass('kubo.kubo') IS NULL
       OR to_regnamespace('kubo_kubo_type_management') IS NULL THEN
        RAISE NOTICE 'Kubo type schema is not provisioned; skipping kubo type hardening';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE UNIQUE INDEX IF NOT EXISTS kubo_type_name_lower_unique
        ON kubo.kubo_type (lower(type_name))
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_kubo_type_management.fn_get_kubo_type_by_id(
            p_kubo_type_id uuid
        )
        RETURNS TABLE(
            kubo_type_id uuid,
            type_name character varying,
            capacity integer,
            price_per_night numeric,
            description character varying
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            kt.kubo_type_id,
            kt.type_name,
            kt.capacity,
            kt.price_per_night,
            kt.description
        FROM kubo.kubo_type AS kt
        WHERE kt.kubo_type_id = p_kubo_type_id;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_kubo_type_management.fn_get_kubo_types(
            p_search text DEFAULT NULL,
            p_min_capacity integer DEFAULT NULL,
            p_max_capacity integer DEFAULT NULL,
            p_limit integer DEFAULT 10,
            p_offset integer DEFAULT 0
        )
        RETURNS TABLE(
            kubo_type_id uuid,
            type_name character varying,
            capacity integer,
            price_per_night numeric,
            description character varying
        )
        LANGUAGE plpgsql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_search text := NULLIF(
                regexp_replace(btrim(p_search), '([\\%_])', '\\\1', 'g'),
                ''
            );
        BEGIN
            IF p_min_capacity IS NOT NULL AND p_min_capacity < 0 THEN
                RAISE EXCEPTION 'Minimum capacity cannot be negative.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_max_capacity IS NOT NULL AND p_max_capacity < 0 THEN
                RAISE EXCEPTION 'Maximum capacity cannot be negative.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_min_capacity IS NOT NULL
               AND p_max_capacity IS NOT NULL
               AND p_min_capacity > p_max_capacity THEN
                RAISE EXCEPTION 'Minimum capacity cannot exceed maximum capacity.'
                    USING ERRCODE = '22023';
            END IF;

            RETURN QUERY
            SELECT
                kt.kubo_type_id,
                kt.type_name,
                kt.capacity,
                kt.price_per_night,
                kt.description
            FROM kubo.kubo_type AS kt
            WHERE (
                    v_search IS NULL
                    OR kt.type_name ILIKE '%' || v_search || '%'
                    OR kt.description ILIKE '%' || v_search || '%'
                )
              AND (p_min_capacity IS NULL OR kt.capacity >= p_min_capacity)
              AND (p_max_capacity IS NULL OR kt.capacity <= p_max_capacity)
            ORDER BY kt.type_name, kt.kubo_type_id
            LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100)
            OFFSET GREATEST(COALESCE(p_offset, 0), 0);
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_kubo_type_management.fn_create_kubo_type(
            p_type_name character varying,
            p_capacity integer,
            p_price_per_night numeric,
            p_description character varying DEFAULT NULL
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

            IF p_capacity IS NULL OR p_capacity <= 0 THEN
                RAISE EXCEPTION 'Capacity must be greater than zero.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_price_per_night IS NULL OR p_price_per_night < 0 THEN
                RAISE EXCEPTION 'Price per night cannot be negative.'
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

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_kubo_type_management.fn_update_kubo_type(
            p_kubo_type_id uuid,
            p_type_name character varying DEFAULT NULL,
            p_capacity integer DEFAULT NULL,
            p_price_per_night numeric DEFAULT NULL,
            p_description character varying DEFAULT NULL
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

            IF p_capacity IS NOT NULL AND p_capacity <= 0 THEN
                RAISE EXCEPTION 'Capacity must be greater than zero.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_price_per_night IS NOT NULL AND p_price_per_night < 0 THEN
                RAISE EXCEPTION 'Price per night cannot be negative.'
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

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_kubo_type_management.fn_delete_unused_kubo_type(
            p_kubo_type_id uuid
        )
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        BEGIN
            PERFORM 1
            FROM kubo.kubo_type AS kt
            WHERE kt.kubo_type_id = p_kubo_type_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RETURN FALSE;
            END IF;

            IF EXISTS (
                SELECT 1
                FROM kubo.kubo AS k
                WHERE k.kubo_type_id = p_kubo_type_id
            ) THEN
                RAISE EXCEPTION 'Kubo type is referenced by kubos. Set those kubos OutOfService instead of deleting the type.'
                    USING ERRCODE = '23503';
            END IF;

            DELETE FROM kubo.kubo_type AS kt
            WHERE kt.kubo_type_id = p_kubo_type_id;

            RETURN TRUE;
        END;
        $function$
    $sql$;
END $$;
