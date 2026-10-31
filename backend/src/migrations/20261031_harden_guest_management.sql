/*
  Migration: 20261031_harden_guest_management.sql
  -----------------------------------------------
  Aligns the guest routines with the guest business rules.

  Included:
  - Case-insensitive unique email and unique (valid ID type, ID number).
  - Reusable create: an existing guest is returned when email or ID details match.
  - Full guest update support (name, contact, address and ID details).
  - Paginated list/search with optional name, email, phone and ID-type filters.
  - Safe get-by-id/email/ID-number lookups.
  - Philippine phone validation for local (09XXXXXXXXX) and +639XXXXXXXXX.
  - Safe unused-guest deletion with reservation protection.

  The legacy sp_create_guest, sp_update_guest_contact and
  sp_delete_unused_guest procedures are left untouched for compatibility but
  are no longer used by the module.
*/

DO $$
BEGIN
    IF to_regclass('kubo.guest') IS NULL
       OR to_regclass('kubo.reservation') IS NULL
       OR to_regtype('kubo.valid_id_type') IS NULL
       OR to_regnamespace('kubo_guest_management') IS NULL THEN
        RAISE NOTICE 'Guest schema is not provisioned; skipping guest management hardening';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE UNIQUE INDEX IF NOT EXISTS guest_email_lower_unique
        ON kubo.guest (lower(email))
    $sql$;

    EXECUTE $sql$
        CREATE UNIQUE INDEX IF NOT EXISTS guest_valid_id_unique
        ON kubo.guest (valid_id_type, lower(id_number))
    $sql$;

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_guest_management.fn_search_guests(
            uuid,
            text,
            text,
            text
        )
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_guest_management.fn_get_guest_by_id(
            p_guest_id uuid
        )
        RETURNS TABLE(
            guest_id uuid,
            first_name character varying,
            last_name character varying,
            email character varying,
            phone character varying,
            address_line_1 character varying,
            city character varying,
            state_province character varying,
            zip_postal_code character varying,
            country character varying,
            valid_id_type kubo.valid_id_type,
            id_number character varying,
            created_at timestamp with time zone,
            updated_at timestamp with time zone
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            g.guest_id,
            g.first_name,
            g.last_name,
            g.email,
            g.phone,
            g.address_line_1,
            g.city,
            g.state_province,
            g.zip_postal_code,
            g.country,
            g.valid_id_type,
            g.id_number,
            g.created_at,
            g.updated_at
        FROM kubo.guest AS g
        WHERE g.guest_id = p_guest_id;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_guest_management.fn_get_guest_by_email(
            p_email character varying
        )
        RETURNS TABLE(
            guest_id uuid,
            first_name character varying,
            last_name character varying,
            email character varying,
            phone character varying,
            address_line_1 character varying,
            city character varying,
            state_province character varying,
            zip_postal_code character varying,
            country character varying,
            valid_id_type kubo.valid_id_type,
            id_number character varying,
            created_at timestamp with time zone,
            updated_at timestamp with time zone
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            g.guest_id,
            g.first_name,
            g.last_name,
            g.email,
            g.phone,
            g.address_line_1,
            g.city,
            g.state_province,
            g.zip_postal_code,
            g.country,
            g.valid_id_type,
            g.id_number,
            g.created_at,
            g.updated_at
        FROM kubo.guest AS g
        WHERE lower(g.email) = lower(btrim(p_email))
        ORDER BY g.updated_at DESC
        LIMIT 1;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_guest_management.fn_get_guest_by_id_number(
            p_valid_id_type kubo.valid_id_type,
            p_id_number character varying
        )
        RETURNS TABLE(
            guest_id uuid,
            first_name character varying,
            last_name character varying,
            email character varying,
            phone character varying,
            address_line_1 character varying,
            city character varying,
            state_province character varying,
            zip_postal_code character varying,
            country character varying,
            valid_id_type kubo.valid_id_type,
            id_number character varying,
            created_at timestamp with time zone,
            updated_at timestamp with time zone
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            g.guest_id,
            g.first_name,
            g.last_name,
            g.email,
            g.phone,
            g.address_line_1,
            g.city,
            g.state_province,
            g.zip_postal_code,
            g.country,
            g.valid_id_type,
            g.id_number,
            g.created_at,
            g.updated_at
        FROM kubo.guest AS g
        WHERE g.valid_id_type = p_valid_id_type
          AND lower(g.id_number) = lower(btrim(p_id_number))
        ORDER BY g.updated_at DESC
        LIMIT 1;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_guest_management.fn_search_guests(
            p_guest_id uuid DEFAULT NULL,
            p_name text DEFAULT NULL,
            p_email text DEFAULT NULL,
            p_phone text DEFAULT NULL,
            p_search text DEFAULT NULL,
            p_valid_id_type kubo.valid_id_type DEFAULT NULL,
            p_limit integer DEFAULT 10,
            p_offset integer DEFAULT 0
        )
        RETURNS TABLE(
            guest_id uuid,
            first_name character varying,
            last_name character varying,
            email character varying,
            phone character varying,
            address_line_1 character varying,
            city character varying,
            state_province character varying,
            zip_postal_code character varying,
            country character varying,
            valid_id_type kubo.valid_id_type,
            id_number character varying,
            created_at timestamp with time zone,
            updated_at timestamp with time zone
        )
        LANGUAGE plpgsql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_name text := NULLIF(
                regexp_replace(btrim(p_name), '([\\%_])', '\\\1', 'g'),
                ''
            );
            v_email text := NULLIF(
                regexp_replace(btrim(p_email), '([\\%_])', '\\\1', 'g'),
                ''
            );
            v_phone text := NULLIF(
                regexp_replace(btrim(p_phone), '([\\%_])', '\\\1', 'g'),
                ''
            );
            v_search text := NULLIF(
                regexp_replace(btrim(p_search), '([\\%_])', '\\\1', 'g'),
                ''
            );
        BEGIN
            RETURN QUERY
            SELECT
                g.guest_id,
                g.first_name,
                g.last_name,
                g.email,
                g.phone,
                g.address_line_1,
                g.city,
                g.state_province,
                g.zip_postal_code,
                g.country,
                g.valid_id_type,
                g.id_number,
                g.created_at,
                g.updated_at
            FROM kubo.guest AS g
            WHERE (p_guest_id IS NULL OR g.guest_id = p_guest_id)
              AND (
                    v_name IS NULL
                    OR (g.first_name || ' ' || g.last_name) ILIKE '%' || v_name || '%'
                    OR (g.last_name || ' ' || g.first_name) ILIKE '%' || v_name || '%'
                )
              AND (v_email IS NULL OR g.email ILIKE '%' || v_email || '%')
              AND (v_phone IS NULL OR g.phone ILIKE '%' || v_phone || '%')
              AND (
                    v_search IS NULL
                    OR (g.first_name || ' ' || g.last_name) ILIKE '%' || v_search || '%'
                    OR (g.last_name || ' ' || g.first_name) ILIKE '%' || v_search || '%'
                    OR g.email ILIKE '%' || v_search || '%'
                    OR g.phone ILIKE '%' || v_search || '%'
                )
              AND (p_valid_id_type IS NULL OR g.valid_id_type = p_valid_id_type)
            ORDER BY g.last_name, g.first_name, g.guest_id
            LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100)
            OFFSET GREATEST(COALESCE(p_offset, 0), 0);
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_guest_management.fn_create_guest(
            p_first_name character varying,
            p_last_name character varying,
            p_email character varying,
            p_phone character varying,
            p_valid_id_type kubo.valid_id_type,
            p_id_number character varying,
            p_address_line_1 character varying DEFAULT NULL,
            p_city character varying DEFAULT NULL,
            p_state_province character varying DEFAULT NULL,
            p_zip_postal_code character varying DEFAULT NULL,
            p_country character varying DEFAULT NULL
        )
        RETURNS TABLE(
            guest_id uuid,
            first_name character varying,
            last_name character varying,
            email character varying,
            phone character varying,
            address_line_1 character varying,
            city character varying,
            state_province character varying,
            zip_postal_code character varying,
            country character varying,
            valid_id_type kubo.valid_id_type,
            id_number character varying,
            created_at timestamp with time zone,
            updated_at timestamp with time zone
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_first text := NULLIF(btrim(p_first_name), '');
            v_last text := NULLIF(btrim(p_last_name), '');
            v_email text := lower(NULLIF(btrim(p_email), ''));
            v_phone text := NULLIF(btrim(p_phone), '');
            v_idno text := NULLIF(btrim(p_id_number), '');
            v_guest kubo.guest%ROWTYPE;
        BEGIN
            IF v_first IS NULL OR length(v_first) > 100
               OR v_last IS NULL OR length(v_last) > 100
               OR v_email IS NULL OR length(v_email) > 100
               OR v_phone IS NULL OR length(v_phone) > 20
               OR p_valid_id_type IS NULL
               OR v_idno IS NULL OR length(v_idno) > 50 THEN
                RAISE EXCEPTION 'First name, last name, email, phone, valid ID type and ID number are required.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
                RAISE EXCEPTION 'Invalid email format: %', v_email
                    USING ERRCODE = '22023';
            END IF;

            IF v_phone !~ '^(09[0-9]{9}|\+639[0-9]{9})$' THEN
                RAISE EXCEPTION 'Phone must use 09XXXXXXXXX or +639XXXXXXXXX format.'
                    USING ERRCODE = '22023';
            END IF;

            -- Reuse an existing guest when the email or ID details already exist.
            SELECT g.*
            INTO v_guest
            FROM kubo.guest AS g
            WHERE lower(g.email) = v_email
               OR (
                    g.valid_id_type = p_valid_id_type
                    AND lower(g.id_number) = lower(v_idno)
               )
            ORDER BY (lower(g.email) = v_email) DESC, g.updated_at DESC
            LIMIT 1;

            IF FOUND THEN
                RETURN QUERY SELECT g.* FROM kubo.guest AS g WHERE g.guest_id = v_guest.guest_id;
                RETURN;
            END IF;

            INSERT INTO kubo.guest (
                first_name,
                last_name,
                email,
                phone,
                address_line_1,
                city,
                state_province,
                zip_postal_code,
                country,
                valid_id_type,
                id_number
            )
            VALUES (
                v_first,
                v_last,
                v_email,
                v_phone,
                NULLIF(btrim(p_address_line_1), ''),
                NULLIF(btrim(p_city), ''),
                NULLIF(btrim(p_state_province), ''),
                NULLIF(btrim(p_zip_postal_code), ''),
                NULLIF(btrim(p_country), ''),
                p_valid_id_type,
                v_idno
            )
            RETURNING * INTO v_guest;

            RETURN QUERY SELECT g.* FROM kubo.guest AS g WHERE g.guest_id = v_guest.guest_id;
        EXCEPTION
            WHEN unique_violation THEN
                SELECT g.*
                INTO v_guest
                FROM kubo.guest AS g
                WHERE lower(g.email) = v_email
                   OR (
                        g.valid_id_type = p_valid_id_type
                        AND lower(g.id_number) = lower(v_idno)
                   )
                ORDER BY (lower(g.email) = v_email) DESC, g.updated_at DESC
                LIMIT 1;

                IF FOUND THEN
                    RETURN QUERY SELECT g.* FROM kubo.guest AS g WHERE g.guest_id = v_guest.guest_id;
                    RETURN;
                END IF;

                RAISE EXCEPTION 'Guest already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_guest_management.fn_update_guest(
            p_guest_id uuid,
            p_first_name character varying DEFAULT NULL,
            p_last_name character varying DEFAULT NULL,
            p_email character varying DEFAULT NULL,
            p_phone character varying DEFAULT NULL,
            p_valid_id_type kubo.valid_id_type DEFAULT NULL,
            p_id_number character varying DEFAULT NULL,
            p_address_line_1 character varying DEFAULT NULL,
            p_city character varying DEFAULT NULL,
            p_state_province character varying DEFAULT NULL,
            p_zip_postal_code character varying DEFAULT NULL,
            p_country character varying DEFAULT NULL
        )
        RETURNS TABLE(
            guest_id uuid,
            first_name character varying,
            last_name character varying,
            email character varying,
            phone character varying,
            address_line_1 character varying,
            city character varying,
            state_province character varying,
            zip_postal_code character varying,
            country character varying,
            valid_id_type kubo.valid_id_type,
            id_number character varying,
            created_at timestamp with time zone,
            updated_at timestamp with time zone
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_first text := NULLIF(btrim(p_first_name), '');
            v_last text := NULLIF(btrim(p_last_name), '');
            v_email text := lower(NULLIF(btrim(p_email), ''));
            v_phone text := NULLIF(btrim(p_phone), '');
            v_idno text := NULLIF(btrim(p_id_number), '');
            v_current kubo.guest%ROWTYPE;
            v_new_valid_id_type kubo.valid_id_type;
            v_new_id_number text;
        BEGIN
            IF p_guest_id IS NULL THEN
                RAISE EXCEPTION 'Guest ID is required.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_first_name IS NULL
               AND p_last_name IS NULL
               AND p_email IS NULL
               AND p_phone IS NULL
               AND p_valid_id_type IS NULL
               AND p_id_number IS NULL
               AND p_address_line_1 IS NULL
               AND p_city IS NULL
               AND p_state_province IS NULL
               AND p_zip_postal_code IS NULL
               AND p_country IS NULL THEN
                RAISE EXCEPTION 'Provide at least one field to update.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_first_name IS NOT NULL
               AND (v_first IS NULL OR length(v_first) > 100) THEN
                RAISE EXCEPTION 'First name must be between 1 and 100 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_last_name IS NOT NULL
               AND (v_last IS NULL OR length(v_last) > 100) THEN
                RAISE EXCEPTION 'Last name must be between 1 and 100 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_email IS NOT NULL
               AND (v_email IS NULL OR length(v_email) > 100) THEN
                RAISE EXCEPTION 'Email must be between 1 and 100 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_email IS NOT NULL
               AND v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
                RAISE EXCEPTION 'Invalid email format: %', v_email
                    USING ERRCODE = '22023';
            END IF;

            IF p_phone IS NOT NULL
               AND (v_phone IS NULL OR length(v_phone) > 20) THEN
                RAISE EXCEPTION 'Phone must be between 1 and 20 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_phone IS NOT NULL
               AND v_phone !~ '^(09[0-9]{9}|\+639[0-9]{9})$' THEN
                RAISE EXCEPTION 'Phone must use 09XXXXXXXXX or +639XXXXXXXXX format.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_id_number IS NOT NULL
               AND (v_idno IS NULL OR length(v_idno) > 50) THEN
                RAISE EXCEPTION 'ID number must be between 1 and 50 characters.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.guest AS g
            WHERE g.guest_id = p_guest_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Guest does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT g.* INTO v_current
            FROM kubo.guest AS g
            WHERE g.guest_id = p_guest_id;

            v_new_valid_id_type := COALESCE(p_valid_id_type, v_current.valid_id_type);
            v_new_id_number := COALESCE(v_idno, v_current.id_number);

            IF v_email IS NOT NULL AND EXISTS (
                SELECT 1
                FROM kubo.guest AS g
                WHERE lower(g.email) = v_email
                  AND g.guest_id <> p_guest_id
            ) THEN
                RAISE EXCEPTION 'A guest with email % already exists.', v_email
                    USING ERRCODE = '23514';
            END IF;

            IF (p_valid_id_type IS NOT NULL OR p_id_number IS NOT NULL)
               AND EXISTS (
                    SELECT 1
                    FROM kubo.guest AS g
                    WHERE g.valid_id_type = v_new_valid_id_type
                      AND lower(g.id_number) = lower(v_new_id_number)
                      AND g.guest_id <> p_guest_id
               ) THEN
                RAISE EXCEPTION 'A guest with the same ID type and ID number already exists.'
                    USING ERRCODE = '23514';
            END IF;

            UPDATE kubo.guest AS g
            SET
                first_name = COALESCE(v_first, g.first_name),
                last_name = COALESCE(v_last, g.last_name),
                email = COALESCE(v_email, g.email),
                phone = COALESCE(v_phone, g.phone),
                valid_id_type = COALESCE(p_valid_id_type, g.valid_id_type),
                id_number = COALESCE(v_idno, g.id_number),
                address_line_1 = COALESCE(NULLIF(btrim(p_address_line_1), ''), g.address_line_1),
                city = COALESCE(NULLIF(btrim(p_city), ''), g.city),
                state_province = COALESCE(NULLIF(btrim(p_state_province), ''), g.state_province),
                zip_postal_code = COALESCE(NULLIF(btrim(p_zip_postal_code), ''), g.zip_postal_code),
                country = COALESCE(NULLIF(btrim(p_country), ''), g.country),
                updated_at = clock_timestamp()
            WHERE g.guest_id = p_guest_id;

            RETURN QUERY SELECT g.* FROM kubo.guest AS g WHERE g.guest_id = p_guest_id;
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'A guest with the same email or ID details already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_guest_management.fn_delete_unused_guest(
            p_guest_id uuid
        )
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        BEGIN
            IF p_guest_id IS NULL THEN
                RAISE EXCEPTION 'Guest ID is required.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.guest AS g
            WHERE g.guest_id = p_guest_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RETURN FALSE;
            END IF;

            IF EXISTS (
                SELECT 1
                FROM kubo.reservation AS r
                WHERE r.guest_id = p_guest_id
            ) THEN
                RAISE EXCEPTION 'Guest % cannot be deleted: referenced by reservations.',
                    p_guest_id
                    USING ERRCODE = '23503';
            END IF;

            DELETE FROM kubo.guest AS g WHERE g.guest_id = p_guest_id;
            RETURN TRUE;
        END;
        $function$
    $sql$;
END $$;
