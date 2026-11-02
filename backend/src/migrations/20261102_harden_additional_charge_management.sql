/*
  Migration: 20261102_harden_additional_charge_management.sql
  -----------------------------------------------------------
  Implements the approved additional-charge hybrid:

  - Admin-managed catalog of predefined charge items.
  - Staff application of active catalog items, with quantity and price snapshot.
  - Staff-submitted custom "Other" requests.
  - Admin approval/rejection/adjustment before a custom charge is billed.
  - Staff pre-settlement deletion of applied charges.
  - Admin increase corrections as new charges.
  - Pending/rejected/withdrawn requests excluded from billing.

  Administrator reductions through Adjustment/Reversal payments remain pending the
  payment module. Audit rows are written through the shared audit routine using the
  temporary actor supplied by the API.
*/

DO $$
BEGIN
    IF to_regclass('kubo.additional_charge') IS NULL
       OR to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.employee') IS NULL
       OR to_regclass('kubo.payment') IS NULL
       OR to_regnamespace('kubo_additional_charges_management') IS NULL THEN
        RAISE NOTICE 'Additional-charge dependencies are not provisioned; skipping migration';
        RETURN;
    END IF;

    EXECUTE $sql$
        DO $enum$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'kubo'
                  AND t.typname = 'charge_request_status'
            ) THEN
                CREATE TYPE kubo.charge_request_status AS ENUM (
                    'Pending',
                    'Approved',
                    'Rejected',
                    'Withdrawn'
                );
            END IF;
        END;
        $enum$;
    $sql$;

    EXECUTE $sql$
        CREATE TABLE IF NOT EXISTS kubo.additional_charge_catalog (
            catalog_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            charge_type kubo.charge_type NOT NULL,
            name varchar(100) NOT NULL,
            description varchar(255),
            unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0),
            is_active boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    $sql$;

    EXECUTE $sql$
        CREATE UNIQUE INDEX IF NOT EXISTS additional_charge_catalog_name_lower_unique
        ON kubo.additional_charge_catalog (lower(name))
    $sql$;

    EXECUTE $sql$
        CREATE TABLE IF NOT EXISTS kubo.additional_charge_request (
            request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            reservation_id uuid NOT NULL REFERENCES kubo.reservation(reservation_id) ON DELETE RESTRICT,
            requested_by uuid NOT NULL REFERENCES kubo.employee(employee_id) ON DELETE RESTRICT,
            charge_type kubo.charge_type NOT NULL DEFAULT 'Other',
            description varchar(255) NOT NULL,
            quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
            proposed_unit_amount numeric(10,2) NOT NULL CHECK (proposed_unit_amount >= 0),
            status kubo.charge_request_status NOT NULL DEFAULT 'Pending',
            reviewed_by uuid REFERENCES kubo.employee(employee_id) ON DELETE RESTRICT,
            approved_unit_amount numeric(10,2) CHECK (approved_unit_amount >= 0),
            review_reason varchar(255),
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            reviewed_at timestamptz
        )
    $sql$;

    EXECUTE $sql$
        ALTER TABLE kubo.additional_charge
        ADD COLUMN IF NOT EXISTS catalog_id uuid
    $sql$;

    EXECUTE $sql$
        ALTER TABLE kubo.additional_charge
        ADD COLUMN IF NOT EXISTS request_id uuid
    $sql$;

    EXECUTE $sql$
        ALTER TABLE kubo.additional_charge
        ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1
    $sql$;

    EXECUTE $sql$
        ALTER TABLE kubo.additional_charge
        ADD COLUMN IF NOT EXISTS unit_amount numeric(10,2)
    $sql$;

    EXECUTE $sql$
        UPDATE kubo.additional_charge
        SET unit_amount = amount
        WHERE unit_amount IS NULL
    $sql$;

    EXECUTE $sql$
        ALTER TABLE kubo.additional_charge
        ALTER COLUMN unit_amount SET NOT NULL
    $sql$;

    EXECUTE $sql$
        DO $constraint$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'additional_charge_catalog_fkey'
            ) THEN
                ALTER TABLE kubo.additional_charge
                ADD CONSTRAINT additional_charge_catalog_fkey
                FOREIGN KEY (catalog_id)
                REFERENCES kubo.additional_charge_catalog(catalog_id)
                ON DELETE RESTRICT;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'additional_charge_request_fkey'
            ) THEN
                ALTER TABLE kubo.additional_charge
                ADD CONSTRAINT additional_charge_request_fkey
                FOREIGN KEY (request_id)
                REFERENCES kubo.additional_charge_request(request_id)
                ON DELETE RESTRICT;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'additional_charge_quantity_check'
            ) THEN
                ALTER TABLE kubo.additional_charge
                ADD CONSTRAINT additional_charge_quantity_check
                CHECK (quantity > 0);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'additional_charge_unit_amount_check'
            ) THEN
                ALTER TABLE kubo.additional_charge
                ADD CONSTRAINT additional_charge_unit_amount_check
                CHECK (unit_amount >= 0);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'additional_charge_total_check'
            ) THEN
                ALTER TABLE kubo.additional_charge
                ADD CONSTRAINT additional_charge_total_check
                CHECK (amount = round(quantity * unit_amount, 2));
            END IF;
        END;
        $constraint$;
    $sql$;

    EXECUTE $sql$
        CREATE INDEX IF NOT EXISTS idx_additional_charge_catalog_id
        ON kubo.additional_charge (catalog_id)
    $sql$;

    EXECUTE $sql$
        CREATE INDEX IF NOT EXISTS idx_additional_charge_request_id
        ON kubo.additional_charge (request_id)
    $sql$;

    EXECUTE $sql$
        CREATE INDEX IF NOT EXISTS idx_additional_charge_request_status
        ON kubo.additional_charge_request (status)
    $sql$;

    EXECUTE $sql$
        CREATE INDEX IF NOT EXISTS idx_additional_charge_request_reservation
        ON kubo.additional_charge_request (reservation_id)
    $sql$;

    EXECUTE $sql$
        DROP ROUTINE IF EXISTS kubo_additional_charges_management.fn_get_reservation_charges(uuid)
    $sql$;

    EXECUTE $sql$
        DROP ROUTINE IF EXISTS kubo_additional_charges_management.sp_record_additional_charge(
            uuid,
            uuid,
            kubo.charge_type,
            numeric,
            character varying
        )
    $sql$;

    EXECUTE $sql$
        DROP ROUTINE IF EXISTS kubo_additional_charges_management.sp_correct_additional_charge(
            uuid,
            uuid,
            kubo.charge_type,
            numeric,
            character varying
        )
    $sql$;

    EXECUTE $sql$
        DROP ROUTINE IF EXISTS kubo_additional_charges_management.sp_delete_additional_charge(
            uuid,
            uuid
        )
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_is_active_administrator(
            p_employee_id uuid
        )
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT EXISTS (
            SELECT 1
            FROM kubo.employee AS e
            WHERE e.employee_id = p_employee_id
              AND e.status = 'Active'
              AND kubo_employee_management.is_administrator_role(e.role_id)
        );
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_is_active_staff(
            p_employee_id uuid
        )
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT EXISTS (
            SELECT 1
            FROM kubo.employee AS e
            WHERE e.employee_id = p_employee_id
              AND e.status = 'Active'
              AND NOT kubo_employee_management.is_administrator_role(e.role_id)
        );
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_is_reservation_settled(
            p_reservation_id uuid
        )
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            EXISTS (
                SELECT 1
                FROM kubo.reservation AS r
                WHERE r.reservation_id = p_reservation_id
                  AND r.status IN ('CheckedOut', 'Cancelled', 'NoShow')
            )
            OR EXISTS (
                SELECT 1
                FROM kubo.payment AS p
                WHERE p.reservation_id = p_reservation_id
                  AND p.payment_status = 'Completed'
                  AND p.transaction_type IN ('Payment', 'Refund')
            );
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_get_catalog_item_by_id(
            p_catalog_id uuid
        )
        RETURNS TABLE(
            catalog_id uuid,
            charge_type kubo.charge_type,
            name character varying,
            description character varying,
            unit_price numeric,
            is_active boolean,
            created_at timestamp with time zone,
            updated_at timestamp with time zone,
            usage_count bigint,
            applied_total numeric
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            c.catalog_id,
            c.charge_type,
            c.name,
            c.description,
            c.unit_price,
            c.is_active,
            c.created_at,
            c.updated_at,
            COALESCE(u.usage_count, 0),
            COALESCE(u.applied_total, 0)
        FROM kubo.additional_charge_catalog AS c
        LEFT JOIN LATERAL (
            SELECT
                count(*) AS usage_count,
                sum(ac.amount) AS applied_total
            FROM kubo.additional_charge AS ac
            WHERE ac.catalog_id = c.catalog_id
        ) AS u ON true
        WHERE c.catalog_id = p_catalog_id;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_get_catalog(
            p_search text DEFAULT NULL,
            p_active_only boolean DEFAULT true,
            p_limit integer DEFAULT 10,
            p_offset integer DEFAULT 0
        )
        RETURNS TABLE(
            catalog_id uuid,
            charge_type kubo.charge_type,
            name character varying,
            description character varying,
            unit_price numeric,
            is_active boolean,
            created_at timestamp with time zone,
            updated_at timestamp with time zone,
            usage_count bigint,
            applied_total numeric
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
                c.catalog_id,
                c.charge_type,
                c.name,
                c.description,
                c.unit_price,
                c.is_active,
                c.created_at,
                c.updated_at,
                COALESCE(u.usage_count, 0),
                COALESCE(u.applied_total, 0)
            FROM kubo.additional_charge_catalog AS c
            LEFT JOIN LATERAL (
                SELECT
                    count(*) AS usage_count,
                    sum(ac.amount) AS applied_total
                FROM kubo.additional_charge AS ac
                WHERE ac.catalog_id = c.catalog_id
            ) AS u ON true
            WHERE (NOT p_active_only OR c.is_active)
              AND (
                    v_search IS NULL
                    OR c.name ILIKE '%' || v_search || '%'
                    OR c.description ILIKE '%' || v_search || '%'
                )
            ORDER BY c.name, c.catalog_id
            LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100)
            OFFSET GREATEST(COALESCE(p_offset, 0), 0);
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_create_catalog_item(
            p_charge_type kubo.charge_type,
            p_name varchar,
            p_description varchar,
            p_unit_price numeric,
            p_is_active boolean,
            p_employee_id uuid
        )
        RETURNS TABLE(
            catalog_id uuid,
            charge_type kubo.charge_type,
            name character varying,
            description character varying,
            unit_price numeric,
            is_active boolean,
            created_at timestamp with time zone,
            updated_at timestamp with time zone,
            usage_count bigint,
            applied_total numeric
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_name text := NULLIF(btrim(p_name), '');
            v_description text := NULLIF(btrim(p_description), '');
            v_catalog_id uuid;
        BEGIN
            IF NOT kubo_additional_charges_management.fn_is_active_administrator(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Administrator may manage the charge catalog.'
                    USING ERRCODE = '42501';
            END IF;

            IF p_charge_type IS NULL THEN
                RAISE EXCEPTION 'Charge type is required.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_name IS NULL OR length(v_name) > 100 THEN
                RAISE EXCEPTION 'Catalog name must be between 1 and 100 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_description IS NOT NULL AND length(v_description) > 255 THEN
                RAISE EXCEPTION 'Catalog description cannot exceed 255 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_unit_price IS NULL OR p_unit_price < 0
               OR p_unit_price <> round(p_unit_price, 2) THEN
                RAISE EXCEPTION 'Unit price must be non-negative with at most two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            IF EXISTS (
                SELECT 1 FROM kubo.additional_charge_catalog AS c
                WHERE lower(c.name) = lower(v_name)
            ) THEN
                RAISE EXCEPTION 'A catalog item with that name already exists.'
                    USING ERRCODE = '23505';
            END IF;

            INSERT INTO kubo.additional_charge_catalog AS c (
                charge_type, name, description, unit_price, is_active
            )
            VALUES (
                p_charge_type, v_name, v_description, p_unit_price, COALESCE(p_is_active, true)
            )
            RETURNING c.catalog_id INTO v_catalog_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Create'::kubo.audit_action,
                'additional_charge_catalog',
                v_catalog_id,
                format('Created charge catalog item %s', v_name),
                NULL,
                (SELECT to_json(c) FROM kubo.additional_charge_catalog AS c WHERE c.catalog_id = v_catalog_id)
            );

            RETURN QUERY
            SELECT * FROM kubo_additional_charges_management.fn_get_catalog_item_by_id(v_catalog_id);
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'A catalog item with that name already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_update_catalog_item(
            p_catalog_id uuid,
            p_charge_type kubo.charge_type DEFAULT NULL,
            p_name varchar DEFAULT NULL,
            p_description varchar DEFAULT NULL,
            p_unit_price numeric DEFAULT NULL,
            p_is_active boolean DEFAULT NULL,
            p_employee_id uuid DEFAULT NULL
        )
        RETURNS TABLE(
            catalog_id uuid,
            charge_type kubo.charge_type,
            name character varying,
            description character varying,
            unit_price numeric,
            is_active boolean,
            created_at timestamp with time zone,
            updated_at timestamp with time zone,
            usage_count bigint,
            applied_total numeric
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_old kubo.additional_charge_catalog%ROWTYPE;
            v_name text := NULLIF(btrim(p_name), '');
            v_description text := NULLIF(btrim(p_description), '');
        BEGIN
            IF NOT kubo_additional_charges_management.fn_is_active_administrator(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Administrator may manage the charge catalog.'
                    USING ERRCODE = '42501';
            END IF;

            IF p_charge_type IS NULL AND p_name IS NULL
               AND p_description IS NULL AND p_unit_price IS NULL
               AND p_is_active IS NULL THEN
                RAISE EXCEPTION 'Provide at least one catalog field to update.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_name IS NOT NULL AND (v_name IS NULL OR length(v_name) > 100) THEN
                RAISE EXCEPTION 'Catalog name must be between 1 and 100 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_description IS NOT NULL
               AND v_description IS NOT NULL
               AND length(v_description) > 255 THEN
                RAISE EXCEPTION 'Catalog description cannot exceed 255 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_unit_price IS NOT NULL
               AND (p_unit_price < 0 OR p_unit_price <> round(p_unit_price, 2)) THEN
                RAISE EXCEPTION 'Unit price must be non-negative with at most two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            SELECT * INTO v_old
            FROM kubo.additional_charge_catalog AS c
            WHERE c.catalog_id = p_catalog_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Catalog item does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_name IS NOT NULL AND EXISTS (
                SELECT 1 FROM kubo.additional_charge_catalog AS c
                WHERE lower(c.name) = lower(v_name)
                  AND c.catalog_id <> p_catalog_id
            ) THEN
                RAISE EXCEPTION 'A catalog item with that name already exists.'
                    USING ERRCODE = '23505';
            END IF;

            UPDATE kubo.additional_charge_catalog AS c
            SET
                charge_type = COALESCE(p_charge_type, c.charge_type),
                name = COALESCE(v_name, c.name),
                description = CASE
                    WHEN p_description IS NULL THEN c.description
                    ELSE v_description
                END,
                unit_price = COALESCE(p_unit_price, c.unit_price),
                is_active = COALESCE(p_is_active, c.is_active),
                updated_at = clock_timestamp()
            WHERE c.catalog_id = p_catalog_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Update'::kubo.audit_action,
                'additional_charge_catalog',
                p_catalog_id,
                'Updated charge catalog item',
                to_json(v_old),
                (SELECT to_json(c) FROM kubo.additional_charge_catalog AS c WHERE c.catalog_id = p_catalog_id)
            );

            RETURN QUERY
            SELECT * FROM kubo_additional_charges_management.fn_get_catalog_item_by_id(p_catalog_id);
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'A catalog item with that name already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_delete_catalog_item(
            p_catalog_id uuid,
            p_employee_id uuid
        )
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_old kubo.additional_charge_catalog%ROWTYPE;
        BEGIN
            IF NOT kubo_additional_charges_management.fn_is_active_administrator(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Administrator may manage the charge catalog.'
                    USING ERRCODE = '42501';
            END IF;

            SELECT * INTO v_old
            FROM kubo.additional_charge_catalog AS c
            WHERE c.catalog_id = p_catalog_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RETURN FALSE;
            END IF;

            IF EXISTS (
                SELECT 1 FROM kubo.additional_charge AS ac
                WHERE ac.catalog_id = p_catalog_id
            ) THEN
                RAISE EXCEPTION 'Catalog item has been used. Deactivate it instead of deleting.'
                    USING ERRCODE = '23503';
            END IF;

            DELETE FROM kubo.additional_charge_catalog AS c
            WHERE c.catalog_id = p_catalog_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Delete'::kubo.audit_action,
                'additional_charge_catalog',
                p_catalog_id,
                format('Deleted charge catalog item %s', v_old.name),
                to_json(v_old),
                NULL
            );

            RETURN TRUE;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_get_charge_by_id(
            p_charge_id uuid
        )
        RETURNS TABLE(
            charge_id uuid,
            reservation_id uuid,
            reference_code character varying,
            employee_id uuid,
            recorded_by text,
            catalog_id uuid,
            catalog_name character varying,
            request_id uuid,
            charge_type kubo.charge_type,
            quantity integer,
            unit_amount numeric,
            amount numeric,
            description character varying,
            charge_date timestamp with time zone
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            ac.charge_id,
            ac.reservation_id,
            r.reference_code,
            ac.employee_id,
            (e.first_name || ' ' || e.last_name)::text,
            ac.catalog_id,
            c.name,
            ac.request_id,
            ac.charge_type,
            ac.quantity,
            ac.unit_amount,
            ac.amount,
            ac.description,
            ac.charge_date
        FROM kubo.additional_charge AS ac
        JOIN kubo.reservation AS r ON r.reservation_id = ac.reservation_id
        JOIN kubo.employee AS e ON e.employee_id = ac.employee_id
        LEFT JOIN kubo.additional_charge_catalog AS c ON c.catalog_id = ac.catalog_id
        WHERE ac.charge_id = p_charge_id;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_get_reservation_charges(
            p_reservation_id uuid
        )
        RETURNS TABLE(
            charge_id uuid,
            reservation_id uuid,
            reference_code character varying,
            employee_id uuid,
            recorded_by text,
            catalog_id uuid,
            catalog_name character varying,
            request_id uuid,
            charge_type kubo.charge_type,
            quantity integer,
            unit_amount numeric,
            amount numeric,
            description character varying,
            charge_date timestamp with time zone
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            ac.charge_id,
            ac.reservation_id,
            r.reference_code,
            ac.employee_id,
            (e.first_name || ' ' || e.last_name)::text,
            ac.catalog_id,
            c.name,
            ac.request_id,
            ac.charge_type,
            ac.quantity,
            ac.unit_amount,
            ac.amount,
            ac.description,
            ac.charge_date
        FROM kubo.additional_charge AS ac
        JOIN kubo.reservation AS r ON r.reservation_id = ac.reservation_id
        JOIN kubo.employee AS e ON e.employee_id = ac.employee_id
        LEFT JOIN kubo.additional_charge_catalog AS c ON c.catalog_id = ac.catalog_id
        WHERE ac.reservation_id = p_reservation_id
        ORDER BY ac.charge_date, ac.charge_id;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_get_charges(
            p_reservation_id uuid DEFAULT NULL,
            p_employee_id uuid DEFAULT NULL,
            p_charge_type kubo.charge_type DEFAULT NULL,
            p_created_from date DEFAULT NULL,
            p_created_to date DEFAULT NULL,
            p_limit integer DEFAULT 10,
            p_offset integer DEFAULT 0
        )
        RETURNS TABLE(
            charge_id uuid,
            reservation_id uuid,
            reference_code character varying,
            employee_id uuid,
            recorded_by text,
            catalog_id uuid,
            catalog_name character varying,
            request_id uuid,
            charge_type kubo.charge_type,
            quantity integer,
            unit_amount numeric,
            amount numeric,
            description character varying,
            charge_date timestamp with time zone
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            ac.charge_id,
            ac.reservation_id,
            r.reference_code,
            ac.employee_id,
            (e.first_name || ' ' || e.last_name)::text,
            ac.catalog_id,
            c.name,
            ac.request_id,
            ac.charge_type,
            ac.quantity,
            ac.unit_amount,
            ac.amount,
            ac.description,
            ac.charge_date
        FROM kubo.additional_charge AS ac
        JOIN kubo.reservation AS r ON r.reservation_id = ac.reservation_id
        JOIN kubo.employee AS e ON e.employee_id = ac.employee_id
        LEFT JOIN kubo.additional_charge_catalog AS c ON c.catalog_id = ac.catalog_id
        WHERE (p_reservation_id IS NULL OR ac.reservation_id = p_reservation_id)
          AND (p_employee_id IS NULL OR ac.employee_id = p_employee_id)
          AND (p_charge_type IS NULL OR ac.charge_type = p_charge_type)
          AND (p_created_from IS NULL OR ac.charge_date::date >= p_created_from)
          AND (p_created_to IS NULL OR ac.charge_date::date <= p_created_to)
        ORDER BY ac.charge_date DESC, ac.charge_id
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100)
        OFFSET GREATEST(COALESCE(p_offset, 0), 0);
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_record_additional_charge(
            p_reservation_id uuid,
            p_employee_id uuid,
            p_catalog_id uuid,
            p_quantity integer
        )
        RETURNS TABLE(
            charge_id uuid,
            reservation_id uuid,
            reference_code character varying,
            employee_id uuid,
            recorded_by text,
            catalog_id uuid,
            catalog_name character varying,
            request_id uuid,
            charge_type kubo.charge_type,
            quantity integer,
            unit_amount numeric,
            amount numeric,
            description character varying,
            charge_date timestamp with time zone
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_catalog kubo.additional_charge_catalog%ROWTYPE;
            v_reservation_status kubo.reservation_status;
            v_charge_id uuid;
        BEGIN
            IF NOT kubo_additional_charges_management.fn_is_active_staff(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Staff member may apply catalog charges.'
                    USING ERRCODE = '42501';
            END IF;

            IF p_quantity IS NULL OR p_quantity <= 0 THEN
                RAISE EXCEPTION 'Quantity must be a positive integer.'
                    USING ERRCODE = '22023';
            END IF;

            SELECT r.status INTO v_reservation_status
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR SHARE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_reservation_status NOT IN ('Pending', 'Confirmed', 'CheckedIn', 'CheckedOut') THEN
                RAISE EXCEPTION 'Charges cannot be applied to a % reservation.', v_reservation_status
                    USING ERRCODE = '23514';
            END IF;

            SELECT * INTO v_catalog
            FROM kubo.additional_charge_catalog AS c
            WHERE c.catalog_id = p_catalog_id
            FOR SHARE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Catalog item does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF NOT v_catalog.is_active THEN
                RAISE EXCEPTION 'Catalog item is inactive.'
                    USING ERRCODE = '23514';
            END IF;

            INSERT INTO kubo.additional_charge AS ac (
                reservation_id,
                employee_id,
                catalog_id,
                charge_type,
                quantity,
                unit_amount,
                amount,
                description
            )
            VALUES (
                p_reservation_id,
                p_employee_id,
                p_catalog_id,
                v_catalog.charge_type,
                p_quantity,
                v_catalog.unit_price,
                round(p_quantity * v_catalog.unit_price, 2),
                v_catalog.name
            )
            RETURNING ac.charge_id INTO v_charge_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Create'::kubo.audit_action,
                'additional_charge',
                v_charge_id,
                format('Applied catalog charge %s x %s', p_quantity, v_catalog.name),
                NULL,
                (SELECT to_json(ac) FROM kubo.additional_charge AS ac WHERE ac.charge_id = v_charge_id)
            );

            RETURN QUERY
            SELECT * FROM kubo_additional_charges_management.fn_get_charge_by_id(v_charge_id);
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_delete_additional_charge(
            p_charge_id uuid,
            p_employee_id uuid
        )
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_old kubo.additional_charge%ROWTYPE;
            v_reservation_id uuid;
        BEGIN
            IF NOT kubo_additional_charges_management.fn_is_active_staff(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Staff member may delete applied charges.'
                    USING ERRCODE = '42501';
            END IF;

            SELECT * INTO v_old
            FROM kubo.additional_charge AS ac
            WHERE ac.charge_id = p_charge_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RETURN FALSE;
            END IF;

            v_reservation_id := v_old.reservation_id;

            IF kubo_additional_charges_management.fn_is_reservation_settled(v_reservation_id) THEN
                RAISE EXCEPTION 'Charge cannot be deleted after settlement.'
                    USING ERRCODE = '23514';
            END IF;

            DELETE FROM kubo.additional_charge AS ac
            WHERE ac.charge_id = p_charge_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Delete'::kubo.audit_action,
                'additional_charge',
                p_charge_id,
                format('Deleted applied charge %s', v_old.charge_type),
                to_json(v_old),
                NULL
            );

            RETURN TRUE;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_add_charge_correction(
            p_charge_id uuid,
            p_employee_id uuid,
            p_charge_type kubo.charge_type,
            p_quantity integer,
            p_unit_amount numeric,
            p_reason varchar
        )
        RETURNS TABLE(
            charge_id uuid,
            reservation_id uuid,
            reference_code character varying,
            employee_id uuid,
            recorded_by text,
            catalog_id uuid,
            catalog_name character varying,
            request_id uuid,
            charge_type kubo.charge_type,
            quantity integer,
            unit_amount numeric,
            amount numeric,
            description character varying,
            charge_date timestamp with time zone
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_original kubo.additional_charge%ROWTYPE;
            v_charge_id uuid;
        BEGIN
            IF NOT kubo_additional_charges_management.fn_is_active_administrator(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Administrator may correct applied charges.'
                    USING ERRCODE = '42501';
            END IF;

            IF p_charge_type IS NULL THEN
                RAISE EXCEPTION 'Charge type is required.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_quantity IS NULL OR p_quantity <= 0 THEN
                RAISE EXCEPTION 'Quantity must be a positive integer.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_unit_amount IS NULL OR p_unit_amount < 0
               OR p_unit_amount <> round(p_unit_amount, 2) THEN
                RAISE EXCEPTION 'Unit amount must be non-negative with at most two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_reason IS NULL OR btrim(p_reason) = '' THEN
                RAISE EXCEPTION 'A correction reason is required.'
                    USING ERRCODE = '22023';
            END IF;

            SELECT * INTO v_original
            FROM kubo.additional_charge AS ac
            WHERE ac.charge_id = p_charge_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Original charge does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            INSERT INTO kubo.additional_charge AS ac (
                reservation_id,
                employee_id,
                charge_type,
                quantity,
                unit_amount,
                amount,
                description
            )
            VALUES (
                v_original.reservation_id,
                p_employee_id,
                p_charge_type,
                p_quantity,
                p_unit_amount,
                round(p_quantity * p_unit_amount, 2),
                btrim(p_reason)
            )
            RETURNING ac.charge_id INTO v_charge_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Create'::kubo.audit_action,
                'additional_charge',
                v_charge_id,
                'Administrator increase correction',
                NULL,
                (SELECT to_json(ac) FROM kubo.additional_charge AS ac WHERE ac.charge_id = v_charge_id)
            );

            RETURN QUERY
            SELECT * FROM kubo_additional_charges_management.fn_get_charge_by_id(v_charge_id);
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_get_charge_request_by_id(
            p_request_id uuid
        )
        RETURNS TABLE(
            request_id uuid,
            reservation_id uuid,
            reference_code character varying,
            guest_name text,
            requested_by uuid,
            requested_by_name text,
            charge_type kubo.charge_type,
            description character varying,
            quantity integer,
            proposed_unit_amount numeric,
            status kubo.charge_request_status,
            reviewed_by uuid,
            reviewed_by_name text,
            approved_unit_amount numeric,
            review_reason character varying,
            created_at timestamp with time zone,
            reviewed_at timestamp with time zone
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            cr.request_id,
            cr.reservation_id,
            r.reference_code,
            (g.first_name || ' ' || g.last_name)::text,
            cr.requested_by,
            (er.first_name || ' ' || er.last_name)::text,
            cr.charge_type,
            cr.description,
            cr.quantity,
            cr.proposed_unit_amount,
            cr.status,
            cr.reviewed_by,
            (ev.first_name || ' ' || ev.last_name)::text,
            cr.approved_unit_amount,
            cr.review_reason,
            cr.created_at,
            cr.reviewed_at
        FROM kubo.additional_charge_request AS cr
        JOIN kubo.reservation AS r ON r.reservation_id = cr.reservation_id
        JOIN kubo.guest AS g ON g.guest_id = r.guest_id
        JOIN kubo.employee AS er ON er.employee_id = cr.requested_by
        LEFT JOIN kubo.employee AS ev ON ev.employee_id = cr.reviewed_by
        WHERE cr.request_id = p_request_id;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_get_charge_requests(
            p_status kubo.charge_request_status DEFAULT NULL,
            p_reservation_id uuid DEFAULT NULL,
            p_requested_by uuid DEFAULT NULL,
            p_limit integer DEFAULT 10,
            p_offset integer DEFAULT 0
        )
        RETURNS TABLE(
            request_id uuid,
            reservation_id uuid,
            reference_code character varying,
            guest_name text,
            requested_by uuid,
            requested_by_name text,
            charge_type kubo.charge_type,
            description character varying,
            quantity integer,
            proposed_unit_amount numeric,
            status kubo.charge_request_status,
            reviewed_by uuid,
            reviewed_by_name text,
            approved_unit_amount numeric,
            review_reason character varying,
            created_at timestamp with time zone,
            reviewed_at timestamp with time zone
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            cr.request_id,
            cr.reservation_id,
            r.reference_code,
            (g.first_name || ' ' || g.last_name)::text,
            cr.requested_by,
            (er.first_name || ' ' || er.last_name)::text,
            cr.charge_type,
            cr.description,
            cr.quantity,
            cr.proposed_unit_amount,
            cr.status,
            cr.reviewed_by,
            (ev.first_name || ' ' || ev.last_name)::text,
            cr.approved_unit_amount,
            cr.review_reason,
            cr.created_at,
            cr.reviewed_at
        FROM kubo.additional_charge_request AS cr
        JOIN kubo.reservation AS r ON r.reservation_id = cr.reservation_id
        JOIN kubo.guest AS g ON g.guest_id = r.guest_id
        JOIN kubo.employee AS er ON er.employee_id = cr.requested_by
        LEFT JOIN kubo.employee AS ev ON ev.employee_id = cr.reviewed_by
        WHERE (p_status IS NULL OR cr.status = p_status)
          AND (p_reservation_id IS NULL OR cr.reservation_id = p_reservation_id)
          AND (p_requested_by IS NULL OR cr.requested_by = p_requested_by)
        ORDER BY cr.created_at DESC, cr.request_id
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100)
        OFFSET GREATEST(COALESCE(p_offset, 0), 0);
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_create_charge_request(
            p_reservation_id uuid,
            p_requested_by uuid,
            p_description varchar,
            p_quantity integer,
            p_proposed_unit_amount numeric
        )
        RETURNS TABLE(
            request_id uuid,
            reservation_id uuid,
            reference_code character varying,
            guest_name text,
            requested_by uuid,
            requested_by_name text,
            charge_type kubo.charge_type,
            description character varying,
            quantity integer,
            proposed_unit_amount numeric,
            status kubo.charge_request_status,
            reviewed_by uuid,
            reviewed_by_name text,
            approved_unit_amount numeric,
            review_reason character varying,
            created_at timestamp with time zone,
            reviewed_at timestamp with time zone
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_reservation_status kubo.reservation_status;
            v_request_id uuid;
        BEGIN
            IF NOT kubo_additional_charges_management.fn_is_active_staff(p_requested_by) THEN
                RAISE EXCEPTION 'Only an active Staff member may submit custom charge requests.'
                    USING ERRCODE = '42501';
            END IF;

            IF p_description IS NULL OR btrim(p_description) = ''
               OR length(btrim(p_description)) > 255 THEN
                RAISE EXCEPTION 'A description between 1 and 255 characters is required.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_quantity IS NULL OR p_quantity <= 0 THEN
                RAISE EXCEPTION 'Quantity must be a positive integer.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_proposed_unit_amount IS NULL OR p_proposed_unit_amount < 0
               OR p_proposed_unit_amount <> round(p_proposed_unit_amount, 2) THEN
                RAISE EXCEPTION 'Proposed unit amount must be non-negative with at most two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            SELECT r.status INTO v_reservation_status
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR SHARE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_reservation_status NOT IN ('Pending', 'Confirmed', 'CheckedIn', 'CheckedOut') THEN
                RAISE EXCEPTION 'Custom requests cannot be submitted for a % reservation.', v_reservation_status
                    USING ERRCODE = '23514';
            END IF;

            INSERT INTO kubo.additional_charge_request AS cr (
                reservation_id,
                requested_by,
                charge_type,
                description,
                quantity,
                proposed_unit_amount,
                status
            )
            VALUES (
                p_reservation_id,
                p_requested_by,
                'Other',
                btrim(p_description),
                p_quantity,
                p_proposed_unit_amount,
                'Pending'
            )
            RETURNING cr.request_id INTO v_request_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_requested_by,
                'Create'::kubo.audit_action,
                'additional_charge_request',
                v_request_id,
                format('Submitted custom charge request: %s', btrim(p_description)),
                NULL,
                (SELECT to_json(cr) FROM kubo.additional_charge_request AS cr WHERE cr.request_id = v_request_id)
            );

            RETURN QUERY
            SELECT * FROM kubo_additional_charges_management.fn_get_charge_request_by_id(v_request_id);
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_withdraw_charge_request(
            p_request_id uuid,
            p_employee_id uuid
        )
        RETURNS TABLE(
            request_id uuid,
            reservation_id uuid,
            reference_code character varying,
            guest_name text,
            requested_by uuid,
            requested_by_name text,
            charge_type kubo.charge_type,
            description character varying,
            quantity integer,
            proposed_unit_amount numeric,
            status kubo.charge_request_status,
            reviewed_by uuid,
            reviewed_by_name text,
            approved_unit_amount numeric,
            review_reason character varying,
            created_at timestamp with time zone,
            reviewed_at timestamp with time zone
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_request kubo.additional_charge_request%ROWTYPE;
        BEGIN
            IF NOT kubo_additional_charges_management.fn_is_active_staff(p_employee_id) THEN
                RAISE EXCEPTION 'Only the requesting Staff member may withdraw this request.'
                    USING ERRCODE = '42501';
            END IF;

            SELECT * INTO v_request
            FROM kubo.additional_charge_request AS cr
            WHERE cr.request_id = p_request_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Charge request does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_request.requested_by <> p_employee_id THEN
                RAISE EXCEPTION 'Only the requesting Staff member may withdraw this request.'
                    USING ERRCODE = '42501';
            END IF;

            IF v_request.status <> 'Pending' THEN
                RAISE EXCEPTION 'Only Pending requests can be withdrawn.'
                    USING ERRCODE = '23514';
            END IF;

            UPDATE kubo.additional_charge_request AS cr
            SET status = 'Withdrawn',
                review_reason = 'Withdrawn by Staff',
                reviewed_at = clock_timestamp()
            WHERE cr.request_id = p_request_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Update'::kubo.audit_action,
                'additional_charge_request',
                p_request_id,
                'Withdrew custom charge request',
                to_json(v_request),
                (SELECT to_json(cr) FROM kubo.additional_charge_request AS cr WHERE cr.request_id = p_request_id)
            );

            RETURN QUERY
            SELECT * FROM kubo_additional_charges_management.fn_get_charge_request_by_id(p_request_id);
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_approve_charge_request(
            p_request_id uuid,
            p_reviewed_by uuid,
            p_approved_unit_amount numeric DEFAULT NULL,
            p_reason varchar DEFAULT NULL
        )
        RETURNS TABLE(
            request_id uuid,
            reservation_id uuid,
            reference_code character varying,
            guest_name text,
            requested_by uuid,
            requested_by_name text,
            charge_type kubo.charge_type,
            description character varying,
            quantity integer,
            proposed_unit_amount numeric,
            status kubo.charge_request_status,
            reviewed_by uuid,
            reviewed_by_name text,
            approved_unit_amount numeric,
            review_reason character varying,
            created_at timestamp with time zone,
            reviewed_at timestamp with time zone
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_request kubo.additional_charge_request%ROWTYPE;
            v_approved numeric(10,2);
            v_charge_id uuid;
        BEGIN
            IF NOT kubo_additional_charges_management.fn_is_active_administrator(p_reviewed_by) THEN
                RAISE EXCEPTION 'Only an active Administrator may review custom charge requests.'
                    USING ERRCODE = '42501';
            END IF;

            SELECT * INTO v_request
            FROM kubo.additional_charge_request AS cr
            WHERE cr.request_id = p_request_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Charge request does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_request.status <> 'Pending' THEN
                RAISE EXCEPTION 'Only Pending requests can be approved.'
                    USING ERRCODE = '23514';
            END IF;

            v_approved := COALESCE(p_approved_unit_amount, v_request.proposed_unit_amount);

            IF v_approved < 0 OR v_approved <> round(v_approved, 2) THEN
                RAISE EXCEPTION 'Approved unit amount must be non-negative with at most two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_approved <> v_request.proposed_unit_amount
               AND (p_reason IS NULL OR btrim(p_reason) = '') THEN
                RAISE EXCEPTION 'A reason is required when adjusting the approved amount.'
                    USING ERRCODE = '22023';
            END IF;

            UPDATE kubo.additional_charge_request AS cr
            SET status = 'Approved',
                reviewed_by = p_reviewed_by,
                approved_unit_amount = v_approved,
                review_reason = NULLIF(btrim(p_reason), ''),
                reviewed_at = clock_timestamp()
            WHERE cr.request_id = p_request_id;

            INSERT INTO kubo.additional_charge AS ac (
                reservation_id,
                employee_id,
                request_id,
                charge_type,
                quantity,
                unit_amount,
                amount,
                description
            )
            VALUES (
                v_request.reservation_id,
                v_request.requested_by,
                p_request_id,
                v_request.charge_type,
                v_request.quantity,
                v_approved,
                round(v_request.quantity * v_approved, 2),
                v_request.description
            )
            RETURNING ac.charge_id INTO v_charge_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_reviewed_by,
                'Update'::kubo.audit_action,
                'additional_charge_request',
                p_request_id,
                'Approved custom charge request',
                to_json(v_request),
                (SELECT to_json(cr) FROM kubo.additional_charge_request AS cr WHERE cr.request_id = p_request_id)
            );

            PERFORM kubo_audit_management.write_audit_log(
                p_reviewed_by,
                'Create'::kubo.audit_action,
                'additional_charge',
                v_charge_id,
                'Created applied charge from approved custom request',
                NULL,
                (SELECT to_json(ac) FROM kubo.additional_charge AS ac WHERE ac.charge_id = v_charge_id)
            );

            RETURN QUERY
            SELECT * FROM kubo_additional_charges_management.fn_get_charge_request_by_id(p_request_id);
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_reject_charge_request(
            p_request_id uuid,
            p_reviewed_by uuid,
            p_reason varchar
        )
        RETURNS TABLE(
            request_id uuid,
            reservation_id uuid,
            reference_code character varying,
            guest_name text,
            requested_by uuid,
            requested_by_name text,
            charge_type kubo.charge_type,
            description character varying,
            quantity integer,
            proposed_unit_amount numeric,
            status kubo.charge_request_status,
            reviewed_by uuid,
            reviewed_by_name text,
            approved_unit_amount numeric,
            review_reason character varying,
            created_at timestamp with time zone,
            reviewed_at timestamp with time zone
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_request kubo.additional_charge_request%ROWTYPE;
        BEGIN
            IF NOT kubo_additional_charges_management.fn_is_active_administrator(p_reviewed_by) THEN
                RAISE EXCEPTION 'Only an active Administrator may review custom charge requests.'
                    USING ERRCODE = '42501';
            END IF;

            IF p_reason IS NULL OR btrim(p_reason) = '' THEN
                RAISE EXCEPTION 'A rejection reason is required.'
                    USING ERRCODE = '22023';
            END IF;

            SELECT * INTO v_request
            FROM kubo.additional_charge_request AS cr
            WHERE cr.request_id = p_request_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Charge request does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_request.status <> 'Pending' THEN
                RAISE EXCEPTION 'Only Pending requests can be rejected.'
                    USING ERRCODE = '23514';
            END IF;

            UPDATE kubo.additional_charge_request AS cr
            SET status = 'Rejected',
                reviewed_by = p_reviewed_by,
                review_reason = btrim(p_reason),
                reviewed_at = clock_timestamp()
            WHERE cr.request_id = p_request_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_reviewed_by,
                'Update'::kubo.audit_action,
                'additional_charge_request',
                p_request_id,
                'Rejected custom charge request',
                to_json(v_request),
                (SELECT to_json(cr) FROM kubo.additional_charge_request AS cr WHERE cr.request_id = p_request_id)
            );

            RETURN QUERY
            SELECT * FROM kubo_additional_charges_management.fn_get_charge_request_by_id(p_request_id);
        END;
        $function$
    $sql$;
END $$;
