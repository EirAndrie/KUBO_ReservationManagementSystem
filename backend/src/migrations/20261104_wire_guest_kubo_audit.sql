/*
  Migration: 20261104_wire_guest_kubo_audit.sql
  ---------------------------------------------
  Wires audit-log writes into guest, kubo-type, and kubo mutations
  (BR-067, BR-068, BR-070, BR-071).

  - Adds an acting-employee parameter to every mutation.
  - Each mutation writes one audit row inside the same transaction.
  - Guest audit values mask id_number (only the last four digits).
  - Deletes write their audit row before the delete.
*/

DO $$
BEGIN
    IF to_regclass('kubo.audit_log') IS NULL
       OR to_regclass('kubo.guest') IS NULL
       OR to_regclass('kubo.kubo_type') IS NULL
       OR to_regclass('kubo.kubo') IS NULL THEN
        RAISE NOTICE 'kubo.guest/kubo_type/kubo or audit_log is not provisioned; skipping guest/kubo audit wiring';
        RETURN;
    END IF;

    -------------------------------------------------------------------------
    -- Shared JSON snapshot helpers
    -------------------------------------------------------------------------

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_guest_management.fn_guest_audit_json(
            p_guest_id uuid
        )
        RETURNS json
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT json_build_object(
            'guest_id', g.guest_id,
            'first_name', g.first_name,
            'last_name', g.last_name,
            'email', g.email,
            'phone', g.phone,
            'address_line_1', g.address_line_1,
            'city', g.city,
            'state_province', g.state_province,
            'zip_postal_code', g.zip_postal_code,
            'country', g.country,
            'valid_id_type', g.valid_id_type,
            'id_number', CASE
                WHEN g.id_number IS NULL THEN NULL
                WHEN length(g.id_number) <= 4 THEN '****'
                ELSE '****' || right(g.id_number, 4)
            END
        )
        FROM kubo.guest AS g
        WHERE g.guest_id = p_guest_id;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_kubo_type_management.fn_kubo_type_audit_json(
            p_kubo_type_id uuid
        )
        RETURNS json
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT json_build_object(
            'kubo_type_id', kt.kubo_type_id,
            'type_name', kt.type_name,
            'capacity', kt.capacity,
            'price_per_night', kt.price_per_night,
            'description', kt.description
        )
        FROM kubo.kubo_type AS kt
        WHERE kt.kubo_type_id = p_kubo_type_id;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_management.fn_kubo_audit_json(
            p_kubo_id uuid
        )
        RETURNS json
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT json_build_object(
            'kubo_id', k.kubo_id,
            'kubo_number', k.kubo_number,
            'kubo_type_id', k.kubo_type_id,
            'status', k.status
        )
        FROM kubo.kubo AS k
        WHERE k.kubo_id = p_kubo_id;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Guest: fn_create_guest
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_guest_management.fn_create_guest(character varying, character varying, character varying, character varying, kubo.valid_id_type, character varying, character varying, character varying, character varying, character varying, character varying)
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
            p_country character varying DEFAULT NULL,
            p_actor_employee_id uuid DEFAULT NULL
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

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Create'::kubo.audit_action,
                'guest',
                v_guest.guest_id,
                format('Created guest %s %s', v_first, v_last),
                NULL,
                kubo_guest_management.fn_guest_audit_json(v_guest.guest_id)
            );

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

    -------------------------------------------------------------------------
    -- Guest: fn_update_guest
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_guest_management.fn_update_guest(uuid, character varying, character varying, character varying, character varying, kubo.valid_id_type, character varying, character varying, character varying, character varying, character varying, character varying)
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
            p_country character varying DEFAULT NULL,
            p_actor_employee_id uuid DEFAULT NULL
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
            v_old json;
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

            v_old := kubo_guest_management.fn_guest_audit_json(p_guest_id);

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

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'guest',
                p_guest_id,
                format('Updated guest %s %s', v_first, v_last),
                v_old,
                kubo_guest_management.fn_guest_audit_json(p_guest_id)
            );

            RETURN QUERY SELECT g.* FROM kubo.guest AS g WHERE g.guest_id = p_guest_id;
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'A guest with the same email or ID details already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Guest: fn_delete_unused_guest
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_guest_management.fn_delete_unused_guest(uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_guest_management.fn_delete_unused_guest(
            p_guest_id uuid,
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

            v_old := kubo_guest_management.fn_guest_audit_json(p_guest_id);

            DELETE FROM kubo.guest AS g WHERE g.guest_id = p_guest_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Delete'::kubo.audit_action,
                'guest',
                p_guest_id,
                format('Deleted guest %s', p_guest_id),
                v_old,
                NULL
            );

            RETURN TRUE;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Kubo type: fn_create_kubo_type
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_kubo_type_management.fn_create_kubo_type(character varying, integer, numeric, character varying)
    $sql$;

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
    -- Kubo type: fn_update_kubo_type
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_kubo_type_management.fn_update_kubo_type(uuid, character varying, integer, numeric, character varying)
    $sql$;

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

    -------------------------------------------------------------------------
    -- Kubo type: fn_delete_unused_kubo_type
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_kubo_type_management.fn_delete_unused_kubo_type(uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_kubo_type_management.fn_delete_unused_kubo_type(
            p_kubo_type_id uuid,
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

            v_old := kubo_kubo_type_management.fn_kubo_type_audit_json(p_kubo_type_id);

            DELETE FROM kubo.kubo_type AS kt
            WHERE kt.kubo_type_id = p_kubo_type_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Delete'::kubo.audit_action,
                'kubo_type',
                p_kubo_type_id,
                format('Deleted kubo type %s', v_old->>'type_name'),
                v_old,
                NULL
            );

            RETURN TRUE;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Kubo: fn_create_kubo
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_management.fn_create_kubo(character varying, uuid, kubo.kubo_status)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_management.fn_create_kubo(
            p_number character varying,
            p_type_id uuid,
            p_status kubo.kubo_status DEFAULT 'Available',
            p_actor_employee_id uuid DEFAULT NULL
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

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Create'::kubo.audit_action,
                'kubo',
                v_kubo.kubo_id,
                format('Created kubo %s', v_number),
                NULL,
                kubo_management.fn_kubo_audit_json(v_kubo.kubo_id)
            );

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

    -------------------------------------------------------------------------
    -- Kubo: fn_update_kubo
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_management.fn_update_kubo(uuid, character varying, uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_management.fn_update_kubo(
            p_kubo_id uuid,
            p_kubo_number character varying DEFAULT NULL,
            p_kubo_type_id uuid DEFAULT NULL,
            p_actor_employee_id uuid DEFAULT NULL
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
            v_old json;
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

            v_old := kubo_management.fn_kubo_audit_json(p_kubo_id);

            UPDATE kubo.kubo AS k
            SET
                kubo_number = COALESCE(v_number, k.kubo_number),
                kubo_type_id = COALESCE(p_kubo_type_id, k.kubo_type_id)
            WHERE k.kubo_id = p_kubo_id
            RETURNING * INTO v_kubo;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'kubo',
                p_kubo_id,
                format('Updated kubo %s', v_kubo.kubo_number),
                v_old,
                kubo_management.fn_kubo_audit_json(p_kubo_id)
            );

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

    -------------------------------------------------------------------------
    -- Kubo: fn_change_kubo_status
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_management.fn_change_kubo_status(uuid, kubo.kubo_status)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_management.fn_change_kubo_status(
            p_kubo_id uuid,
            p_status kubo.kubo_status,
            p_actor_employee_id uuid DEFAULT NULL
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
            v_old json;
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

            v_old := kubo_management.fn_kubo_audit_json(p_kubo_id);

            UPDATE kubo.kubo AS k
            SET status = p_status
            WHERE k.kubo_id = p_kubo_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'kubo',
                p_kubo_id,
                format('Changed kubo %s status from %s to %s', v_current.kubo_number, v_current.status, p_status),
                v_old,
                kubo_management.fn_kubo_audit_json(p_kubo_id)
            );

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

    -------------------------------------------------------------------------
    -- Kubo: fn_delete_unused_kubo
    -------------------------------------------------------------------------

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_management.fn_delete_unused_kubo(uuid)
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_management.fn_delete_unused_kubo(
            p_kubo_id uuid,
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

            v_old := kubo_management.fn_kubo_audit_json(p_kubo_id);

            DELETE FROM kubo.kubo AS k
            WHERE k.kubo_id = p_kubo_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Delete'::kubo.audit_action,
                'kubo',
                p_kubo_id,
                format('Deleted kubo %s', v_old->>'kubo_number'),
                v_old,
                NULL
            );

            RETURN TRUE;
        END;
        $function$
    $sql$;

END $$;
