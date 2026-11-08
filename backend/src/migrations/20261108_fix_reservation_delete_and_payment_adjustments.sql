/*
  Migration: 20261108_fix_reservation_delete_and_payment_adjustments.sql
  --------------------------------------------------------------------
  Fixes reservation deletion ordering and resolves payment correction gap G-07.

  A completed Adjustment is a positive, non-cash credit against one applied
  additional charge. A completed Reversal references an Adjustment and offsets
  some or all of that credit. Cash paid remains separate from corrections;
  guests who are owed cash still receive a normal Refund transaction.
*/

DO $$
BEGIN
    IF to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL
       OR to_regclass('kubo.payment') IS NULL
       OR to_regclass('kubo.additional_charge') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_reservation_audit_json(uuid)') IS NULL
       OR to_regprocedure('kubo_audit_management.write_audit_log(uuid,kubo.audit_action,character varying,uuid,text,json,json)') IS NULL
       OR to_regprocedure('kubo_payment_management.fn_is_active_administrator(uuid)') IS NULL THEN
        RAISE NOTICE 'Reservation/payment correction dependencies are not provisioned; skipping migration';
        RETURN;
    END IF;

    EXECUTE $ddl$
        ALTER TABLE kubo.payment
            ADD COLUMN IF NOT EXISTS description varchar(255),
            ADD COLUMN IF NOT EXISTS related_payment_id uuid,
            ADD COLUMN IF NOT EXISTS related_charge_id uuid
    $ddl$;

    EXECUTE $constraints$
        DO $inner$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'payment_related_payment_id_fkey'
                  AND conrelid = 'kubo.payment'::regclass
            ) THEN
                ALTER TABLE kubo.payment
                    ADD CONSTRAINT payment_related_payment_id_fkey
                    FOREIGN KEY (related_payment_id)
                    REFERENCES kubo.payment(payment_id)
                    ON DELETE RESTRICT;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'payment_related_charge_id_fkey'
                  AND conrelid = 'kubo.payment'::regclass
            ) THEN
                ALTER TABLE kubo.payment
                    ADD CONSTRAINT payment_related_charge_id_fkey
                    FOREIGN KEY (related_charge_id)
                    REFERENCES kubo.additional_charge(charge_id)
                    ON DELETE RESTRICT;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'payment_correction_fields_check'
                  AND conrelid = 'kubo.payment'::regclass
            ) THEN
                ALTER TABLE kubo.payment
                    ADD CONSTRAINT payment_correction_fields_check
                    CHECK (
                        transaction_type NOT IN ('Adjustment', 'Reversal')
                        OR (
                            payment_amount > 0
                            AND payment_status = 'Completed'
                            AND description IS NOT NULL
                            AND length(btrim(description)) > 0
                            AND (
                                (transaction_type = 'Adjustment'
                                 AND related_charge_id IS NOT NULL
                                 AND related_payment_id IS NULL)
                                OR
                                (transaction_type = 'Reversal'
                                 AND related_charge_id IS NOT NULL
                                 AND related_payment_id IS NOT NULL)
                            )
                        )
                    ) NOT VALID;
            END IF;
        END;
        $inner$;
    $constraints$;

    EXECUTE $ddl$
        CREATE INDEX IF NOT EXISTS payment_related_payment_id_idx
            ON kubo.payment (related_payment_id)
            WHERE related_payment_id IS NOT NULL
    $ddl$;

    EXECUTE $ddl$
        CREATE INDEX IF NOT EXISTS payment_related_charge_id_idx
            ON kubo.payment (related_charge_id)
            WHERE related_charge_id IS NOT NULL
    $ddl$;

    -------------------------------------------------------------------------
    -- Delete assignment rows before their reservation parent. Keep the audit
    -- snapshot and kubo-release behavior within the same transaction.
    -------------------------------------------------------------------------
    EXECUTE $fn$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_delete_reservation(
            p_reservation_id uuid,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_kubo_ids uuid[];
            v_kubo_id uuid;
            v_old json;
        BEGIN
            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RETURN FALSE;
            END IF;

            IF EXISTS (
                SELECT 1 FROM kubo.payment AS p
                WHERE p.reservation_id = p_reservation_id
            ) OR EXISTS (
                SELECT 1 FROM kubo.additional_charge AS ac
                WHERE ac.reservation_id = p_reservation_id
            ) THEN
                RAISE EXCEPTION 'Reservation has financial history; cancel it instead of deleting.'
                    USING ERRCODE = '23503';
            END IF;

            v_old := kubo_reservation_management.fn_reservation_audit_json(p_reservation_id);

            SELECT array_agg(rk.kubo_id)
            INTO v_kubo_ids
            FROM kubo.reserved_kubo AS rk
            WHERE rk.reservation_id = p_reservation_id;

            DELETE FROM kubo.reserved_kubo AS rk
            WHERE rk.reservation_id = p_reservation_id;

            DELETE FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Delete'::kubo.audit_action,
                'reservation',
                p_reservation_id,
                format('Deleted reservation %s', v_old->>'reference_code'),
                v_old,
                NULL
            );

            IF v_kubo_ids IS NOT NULL THEN
                FOREACH v_kubo_id IN ARRAY v_kubo_ids LOOP
                    PERFORM kubo_reservation_management.fn_release_kubo(v_kubo_id);
                END LOOP;
            END IF;

            RETURN TRUE;
        END;
        $function$
    $fn$;

    -------------------------------------------------------------------------
    -- Keep cash net paid distinct from the non-cash reduction ledger.
    -------------------------------------------------------------------------
    EXECUTE $fn$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_get_reservation_balance(
            p_reservation_id uuid
        )
        RETURNS TABLE(
            accommodation_total numeric,
            charges_total numeric,
            net_paid numeric,
            outstanding_balance numeric
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        WITH amounts AS (
            SELECT
                COALESCE((
                    SELECT SUM((rk.check_out_date - rk.check_in_date) * rk.price_at_booking)
                    FROM kubo.reserved_kubo AS rk
                    WHERE rk.reservation_id = p_reservation_id
                      AND rk.status NOT IN ('Cancelled', 'NoShow')
                ), 0)::numeric AS accommodation,
                COALESCE((
                    SELECT SUM(ac.amount)
                    FROM kubo.additional_charge AS ac
                    WHERE ac.reservation_id = p_reservation_id
                ), 0)::numeric AS charges,
                COALESCE((
                    SELECT SUM(
                        CASE
                            WHEN p.transaction_type = 'Payment'
                                 AND p.payment_status IN ('Completed', 'PartiallyRefunded', 'Refunded')
                                THEN p.payment_amount
                            WHEN p.transaction_type = 'Refund'
                                 AND p.payment_status = 'Completed'
                                THEN -p.payment_amount
                            ELSE 0
                        END
                    )
                    FROM kubo.payment AS p
                    WHERE p.reservation_id = p_reservation_id
                ), 0)::numeric AS paid,
                COALESCE((
                    SELECT SUM(
                        CASE
                            WHEN p.transaction_type = 'Adjustment'
                                 AND p.payment_status = 'Completed'
                                THEN p.payment_amount
                            WHEN p.transaction_type = 'Reversal'
                                 AND p.payment_status = 'Completed'
                                THEN -p.payment_amount
                            ELSE 0
                        END
                    )
                    FROM kubo.payment AS p
                    WHERE p.reservation_id = p_reservation_id
                ), 0)::numeric AS charge_reductions
        )
        SELECT
            a.accommodation AS accommodation_total,
            a.accommodation + a.charges AS charges_total,
            a.paid AS net_paid,
            (a.accommodation + a.charges - a.paid - a.charge_reductions)
                AS outstanding_balance
        FROM amounts AS a;
        $function$
    $fn$;

    -------------------------------------------------------------------------
    -- Additive response functions expose the correction reason and links while
    -- leaving existing stored-function signatures backward compatible.
    -------------------------------------------------------------------------
    EXECUTE $fn$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_get_payment_details_by_id(
            p_payment_id uuid
        )
        RETURNS TABLE(
            payment_id uuid,
            reservation_id uuid,
            reference_code character varying,
            employee_id uuid,
            recorded_by text,
            payment_amount numeric,
            transaction_type kubo.transaction_type,
            payment_type kubo.payment_type,
            payment_method kubo.payment_method,
            payment_status kubo.payment_status,
            payment_date timestamp with time zone,
            description character varying,
            related_payment_id uuid,
            related_charge_id uuid
        )
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
            SELECT p.payment_id, p.reservation_id, r.reference_code,
                   p.employee_id, (e.first_name || ' ' || e.last_name)::text,
                   p.payment_amount, p.transaction_type, p.payment_type,
                   p.payment_method, p.payment_status, p.payment_date,
                   p.description, p.related_payment_id, p.related_charge_id
            FROM kubo.payment AS p
            JOIN kubo.reservation AS r ON r.reservation_id = p.reservation_id
            JOIN kubo.employee AS e ON e.employee_id = p.employee_id
            WHERE p.payment_id = p_payment_id;
        $function$
    $fn$;

    EXECUTE $fn$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_get_payment_details_by_reservation(
            p_reservation_id uuid
        )
        RETURNS TABLE(
            payment_id uuid,
            reservation_id uuid,
            reference_code character varying,
            employee_id uuid,
            recorded_by text,
            payment_amount numeric,
            transaction_type kubo.transaction_type,
            payment_type kubo.payment_type,
            payment_method kubo.payment_method,
            payment_status kubo.payment_status,
            payment_date timestamp with time zone,
            description character varying,
            related_payment_id uuid,
            related_charge_id uuid
        )
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
            SELECT p.payment_id, p.reservation_id, r.reference_code,
                   p.employee_id, (e.first_name || ' ' || e.last_name)::text,
                   p.payment_amount, p.transaction_type, p.payment_type,
                   p.payment_method, p.payment_status, p.payment_date,
                   p.description, p.related_payment_id, p.related_charge_id
            FROM kubo.payment AS p
            JOIN kubo.reservation AS r ON r.reservation_id = p.reservation_id
            JOIN kubo.employee AS e ON e.employee_id = p.employee_id
            WHERE p.reservation_id = p_reservation_id
            ORDER BY p.payment_date, p.payment_id;
        $function$
    $fn$;

    EXECUTE $fn$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_get_payment_details(
            p_reservation_id uuid DEFAULT NULL,
            p_employee_id uuid DEFAULT NULL,
            p_payment_status kubo.payment_status DEFAULT NULL,
            p_payment_method kubo.payment_method DEFAULT NULL,
            p_transaction_type kubo.transaction_type DEFAULT NULL,
            p_created_from date DEFAULT NULL,
            p_created_to date DEFAULT NULL,
            p_limit integer DEFAULT 10,
            p_offset integer DEFAULT 0
        )
        RETURNS TABLE(
            payment_id uuid,
            reservation_id uuid,
            reference_code character varying,
            employee_id uuid,
            recorded_by text,
            payment_amount numeric,
            transaction_type kubo.transaction_type,
            payment_type kubo.payment_type,
            payment_method kubo.payment_method,
            payment_status kubo.payment_status,
            payment_date timestamp with time zone,
            description character varying,
            related_payment_id uuid,
            related_charge_id uuid
        )
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
            SELECT p.payment_id, p.reservation_id, r.reference_code,
                   p.employee_id, (e.first_name || ' ' || e.last_name)::text,
                   p.payment_amount, p.transaction_type, p.payment_type,
                   p.payment_method, p.payment_status, p.payment_date,
                   p.description, p.related_payment_id, p.related_charge_id
            FROM kubo.payment AS p
            JOIN kubo.reservation AS r ON r.reservation_id = p.reservation_id
            JOIN kubo.employee AS e ON e.employee_id = p.employee_id
            WHERE (p_reservation_id IS NULL OR p.reservation_id = p_reservation_id)
              AND (p_employee_id IS NULL OR p.employee_id = p_employee_id)
              AND (p_payment_status IS NULL OR p.payment_status = p_payment_status)
              AND (p_payment_method IS NULL OR p.payment_method = p_payment_method)
              AND (p_transaction_type IS NULL OR p.transaction_type = p_transaction_type)
              AND (p_created_from IS NULL OR p.payment_date::date >= p_created_from)
              AND (p_created_to IS NULL OR p.payment_date::date <= p_created_to)
            ORDER BY p.payment_date DESC, p.payment_id
            LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100)
            OFFSET GREATEST(COALESCE(p_offset, 0), 0);
        $function$
    $fn$;

    -------------------------------------------------------------------------
    -- Administrator-only, append-only charge reduction and its reversal.
    -------------------------------------------------------------------------
    EXECUTE $fn$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_record_charge_adjustment(
            p_reservation_id uuid,
            p_charge_id uuid,
            p_employee_id uuid,
            p_payment_amount numeric,
            p_description varchar
        )
        RETURNS uuid
        LANGUAGE plpgsql SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_charge_amount numeric;
            v_adjusted_amount numeric;
            v_payment_id uuid;
        BEGIN
            IF NOT kubo_payment_management.fn_is_active_administrator(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Administrator may reduce an applied charge.'
                    USING ERRCODE = '42501';
            END IF;

            IF p_payment_amount IS NULL OR p_payment_amount <= 0
               OR p_payment_amount <> round(p_payment_amount, 2) THEN
                RAISE EXCEPTION 'Adjustment amount must be positive with at most two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            IF NULLIF(btrim(p_description), '') IS NULL THEN
                RAISE EXCEPTION 'A reason is required for a charge reduction.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT ac.amount INTO v_charge_amount
            FROM kubo.additional_charge AS ac
            WHERE ac.charge_id = p_charge_id
              AND ac.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Applied charge does not belong to this reservation.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT COALESCE(SUM(
                CASE p.transaction_type
                    WHEN 'Adjustment' THEN p.payment_amount
                    WHEN 'Reversal' THEN -p.payment_amount
                    ELSE 0
                END
            ), 0)
            INTO v_adjusted_amount
            FROM kubo.payment AS p
            WHERE p.related_charge_id = p_charge_id
              AND p.transaction_type IN ('Adjustment', 'Reversal')
              AND p.payment_status = 'Completed';

            IF p_payment_amount > v_charge_amount - v_adjusted_amount THEN
                RAISE EXCEPTION 'Adjustment exceeds the unapplied amount of this charge (%).',
                    v_charge_amount - v_adjusted_amount
                    USING ERRCODE = '23514';
            END IF;

            INSERT INTO kubo.payment (
                reservation_id, employee_id, payment_amount, transaction_type,
                payment_type, payment_method, payment_status, description,
                related_charge_id
            )
            VALUES (
                p_reservation_id, p_employee_id, p_payment_amount, 'Adjustment',
                'AdditionalCharge', 'Other', 'Completed', btrim(p_description),
                p_charge_id
            )
            RETURNING payment_id INTO v_payment_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Create'::kubo.audit_action,
                'payment',
                v_payment_id,
                format('Reduced applied charge %s by %s: %s',
                    p_charge_id, p_payment_amount, btrim(p_description)),
                NULL,
                (SELECT to_json(p) FROM kubo.payment AS p WHERE p.payment_id = v_payment_id)
            );

            RETURN v_payment_id;
        END;
        $function$
    $fn$;

    EXECUTE $fn$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_reverse_charge_adjustment(
            p_reservation_id uuid,
            p_adjustment_payment_id uuid,
            p_employee_id uuid,
            p_payment_amount numeric,
            p_description varchar
        )
        RETURNS uuid
        LANGUAGE plpgsql SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_adjustment kubo.payment%ROWTYPE;
            v_reversed_amount numeric;
            v_remaining_amount numeric;
            v_payment_id uuid;
        BEGIN
            IF NOT kubo_payment_management.fn_is_active_administrator(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Administrator may reverse a charge adjustment.'
                    USING ERRCODE = '42501';
            END IF;

            IF p_payment_amount IS NULL OR p_payment_amount <= 0
               OR p_payment_amount <> round(p_payment_amount, 2) THEN
                RAISE EXCEPTION 'Reversal amount must be positive with at most two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            IF NULLIF(btrim(p_description), '') IS NULL THEN
                RAISE EXCEPTION 'A reason is required for a reversal.'
                    USING ERRCODE = '22023';
            END IF;

            PERFORM 1
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT * INTO v_adjustment
            FROM kubo.payment AS p
            WHERE p.payment_id = p_adjustment_payment_id
              AND p.reservation_id = p_reservation_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Adjustment does not belong to this reservation.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_adjustment.transaction_type <> 'Adjustment'
               OR v_adjustment.payment_status <> 'Completed'
               OR v_adjustment.related_charge_id IS NULL THEN
                RAISE EXCEPTION 'Only a completed charge Adjustment can be reversed.'
                    USING ERRCODE = '23514';
            END IF;

            SELECT COALESCE(SUM(p.payment_amount), 0)
            INTO v_reversed_amount
            FROM kubo.payment AS p
            WHERE p.related_payment_id = p_adjustment_payment_id
              AND p.transaction_type = 'Reversal'
              AND p.payment_status = 'Completed';

            v_remaining_amount := v_adjustment.payment_amount - v_reversed_amount;

            IF p_payment_amount > v_remaining_amount THEN
                RAISE EXCEPTION 'Reversal exceeds the remaining adjustment amount (%).',
                    v_remaining_amount
                    USING ERRCODE = '23514';
            END IF;

            INSERT INTO kubo.payment (
                reservation_id, employee_id, payment_amount, transaction_type,
                payment_type, payment_method, payment_status, description,
                related_payment_id, related_charge_id
            )
            VALUES (
                p_reservation_id, p_employee_id, p_payment_amount, 'Reversal',
                'AdditionalCharge', 'Other', 'Completed', btrim(p_description),
                p_adjustment_payment_id, v_adjustment.related_charge_id
            )
            RETURNING payment_id INTO v_payment_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Create'::kubo.audit_action,
                'payment',
                v_payment_id,
                format('Reversed %s of charge Adjustment %s: %s',
                    p_payment_amount, p_adjustment_payment_id, btrim(p_description)),
                NULL,
                (SELECT to_json(p) FROM kubo.payment AS p WHERE p.payment_id = v_payment_id)
            );

            RETURN v_payment_id;
        END;
        $function$
    $fn$;
END $$;
