/*
  Migration: 20261101_harden_kubo_management.sql
  -------------------------------------------------
  Adds the kubo routines required by the module and business rules.

  Included:
  - Create/read/list/update routines returning kubo + type data.
  - Separate status-transition routine enforcing BR-021.
  - Reference-safe deletion for kubos with no reserved_kubo history.
  - Availability search with kubo-type filtering, Cleaning handling per A-07,
    and past-date rejection per BR-029.

  Audit writes are intentionally deferred until authentication provides a
  trusted acting employee.
*/

DO $$
BEGIN
    IF to_regclass('kubo.kubo') IS NULL
       OR to_regclass('kubo.kubo_type') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL
       OR to_regclass('kubo.reservation') IS NULL
       OR to_regnamespace('kubo_management') IS NULL THEN
        RAISE NOTICE 'Kubo schema is not provisioned; skipping kubo management hardening';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_management.fn_get_kubo_by_id(
            p_kubo_id uuid
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
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
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
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_management.fn_get_kubos(
            p_search text DEFAULT NULL,
            p_kubo_type_id uuid DEFAULT NULL,
            p_status kubo.kubo_status DEFAULT NULL,
            p_limit integer DEFAULT 10,
            p_offset integer DEFAULT 0
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
            WHERE (
                    v_search IS NULL
                    OR k.kubo_number ILIKE '%' || v_search || '%'
                    OR t.type_name ILIKE '%' || v_search || '%'
                )
              AND (p_kubo_type_id IS NULL OR k.kubo_type_id = p_kubo_type_id)
              AND (p_status IS NULL OR k.status = p_status)
            ORDER BY k.kubo_number, k.kubo_id
            LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100)
            OFFSET GREATEST(COALESCE(p_offset, 0), 0);
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_management.fn_create_kubo(
            p_number character varying,
            p_type_id uuid,
            p_status kubo.kubo_status DEFAULT 'Available'
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
            v_number text := NULLIF(btrim(p_number), '');
            v_kubo kubo.kubo%ROWTYPE;
        BEGIN
            IF v_number IS NULL OR length(v_number) > 20 THEN
                RAISE EXCEPTION 'Kubo number must contain 1 to 20 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_status IS NULL
               OR p_status NOT IN ('Available', 'Maintenance', 'OutOfService') THEN
                RAISE EXCEPTION 'Invalid initial Kubo status.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.kubo_type AS t
            WHERE t.kubo_type_id = p_type_id
            FOR KEY SHARE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Kubo type does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            INSERT INTO kubo.kubo (kubo_number, kubo_type_id, status)
            VALUES (v_number, p_type_id, p_status)
            RETURNING * INTO v_kubo;

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
            WHERE k.kubo_id = v_kubo.kubo_id;
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'Kubo number already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_management.fn_update_kubo(
            p_kubo_id uuid,
            p_kubo_number character varying DEFAULT NULL,
            p_kubo_type_id uuid DEFAULT NULL
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
            v_number text := NULLIF(btrim(p_kubo_number), '');
            v_kubo kubo.kubo%ROWTYPE;
        BEGIN
            IF p_kubo_number IS NULL AND p_kubo_type_id IS NULL THEN
                RAISE EXCEPTION 'Provide at least one field to update.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_kubo_number IS NOT NULL
               AND (v_number IS NULL OR length(v_number) > 20) THEN
                RAISE EXCEPTION 'Kubo number must contain 1 to 20 characters.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.kubo AS k
            WHERE k.kubo_id = p_kubo_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Kubo does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF p_kubo_type_id IS NOT NULL THEN
                PERFORM 1
                FROM kubo.kubo_type AS t
                WHERE t.kubo_type_id = p_kubo_type_id
                FOR KEY SHARE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Kubo type does not exist.'
                        USING ERRCODE = 'P0002';
                END IF;
            END IF;

            IF v_number IS NOT NULL AND EXISTS (
                SELECT 1
                FROM kubo.kubo AS k
                WHERE k.kubo_number = v_number
                  AND k.kubo_id <> p_kubo_id
            ) THEN
                RAISE EXCEPTION 'Kubo number already exists.'
                    USING ERRCODE = '23505';
            END IF;

            UPDATE kubo.kubo AS k
            SET
                kubo_number = COALESCE(v_number, k.kubo_number),
                kubo_type_id = COALESCE(p_kubo_type_id, k.kubo_type_id)
            WHERE k.kubo_id = p_kubo_id
            RETURNING * INTO v_kubo;

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
            WHERE k.kubo_id = v_kubo.kubo_id;
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'Kubo number already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_management.fn_change_kubo_status(
            p_kubo_id uuid,
            p_status kubo.kubo_status
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
        BEGIN
            IF p_status IS NULL THEN
                RAISE EXCEPTION 'A target Kubo status is required.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.kubo AS k
            WHERE k.kubo_id = p_kubo_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Kubo does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT k.* INTO v_current
            FROM kubo.kubo AS k
            WHERE k.kubo_id = p_kubo_id;

            IF v_current.status = p_status THEN
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
                RETURN;
            END IF;

            IF NOT (
                (v_current.status = 'Available'
                 AND p_status IN ('Reserved', 'Occupied', 'Cleaning', 'Maintenance', 'UnderInspection', 'OutOfService'))
                OR (v_current.status = 'Reserved'
                    AND p_status IN ('Occupied', 'Available', 'Maintenance', 'UnderInspection', 'OutOfService'))
                OR (v_current.status = 'Occupied'
                    AND p_status IN ('Cleaning', 'Maintenance', 'UnderInspection', 'OutOfService'))
                OR (v_current.status = 'Cleaning'
                    AND p_status IN ('Available', 'Maintenance', 'UnderInspection', 'OutOfService'))
                OR (v_current.status = 'Maintenance'
                    AND p_status IN ('Available'))
                OR (v_current.status = 'UnderInspection'
                    AND p_status IN ('Available'))
                OR (v_current.status = 'OutOfService'
                    AND p_status IN ('Available'))
            ) THEN
                RAISE EXCEPTION 'Invalid Kubo status transition from % to %.',
                    v_current.status, p_status
                    USING ERRCODE = '23514';
            END IF;

            UPDATE kubo.kubo AS k
            SET status = p_status
            WHERE k.kubo_id = p_kubo_id;

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

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_management.fn_delete_unused_kubo(
            p_kubo_id uuid
        )
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        BEGIN
            PERFORM 1
            FROM kubo.kubo AS k
            WHERE k.kubo_id = p_kubo_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RETURN FALSE;
            END IF;

            IF EXISTS (
                SELECT 1
                FROM kubo.reserved_kubo AS rk
                WHERE rk.kubo_id = p_kubo_id
            ) THEN
                RAISE EXCEPTION 'Kubo has assignment history. Set its status to OutOfService instead of deleting it.'
                    USING ERRCODE = '23503';
            END IF;

            DELETE FROM kubo.kubo AS k
            WHERE k.kubo_id = p_kubo_id;

            RETURN TRUE;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_management.fn_search_available_kubos(date, date)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_management.fn_search_available_kubos(
            p_check_in date,
            p_check_out date,
            p_kubo_type_id uuid DEFAULT NULL
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
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        BEGIN
            IF p_check_in IS NULL OR p_check_out IS NULL
               OR p_check_out <= p_check_in THEN
                RAISE EXCEPTION 'Checkout must follow check-in.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_check_in < CURRENT_DATE THEN
                RAISE EXCEPTION 'Check-in date cannot be in the past.'
                    USING ERRCODE = '22023';
            END IF;

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
            WHERE (
                    k.status IN ('Available', 'Reserved', 'Occupied')
                    OR (k.status = 'Cleaning' AND p_check_in > CURRENT_DATE)
                )
              AND (p_kubo_type_id IS NULL OR k.kubo_type_id = p_kubo_type_id)
              AND NOT EXISTS (
                    SELECT 1
                    FROM kubo.reserved_kubo AS rk
                    JOIN kubo.reservation AS r ON r.reservation_id = rk.reservation_id
                    WHERE rk.kubo_id = k.kubo_id
                      AND (
                            (rk.status IN ('Reserved', 'CheckedIn')
                             AND r.status IN ('Pending', 'Confirmed', 'CheckedIn')
                             AND rk.check_in_date < p_check_out
                             AND rk.check_out_date > p_check_in)
                            OR (rk.status = 'CheckedIn'
                                AND p_check_in <= CURRENT_DATE)
                      )
              )
            ORDER BY k.kubo_number, k.kubo_id;
        END;
        $function$
    $sql$;
END $$;
