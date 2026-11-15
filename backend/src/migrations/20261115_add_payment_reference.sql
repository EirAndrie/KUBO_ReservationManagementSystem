/*
  Migration: 20261115_add_payment_reference.sql
  -------------------------------------------------
  Stores the third-party transaction reference the desk reads from a GCash,
  Maya, card, or bank receipt. The project has no payment-provider integration:
  Staff confirm the transaction on the provider's side and type the reference
  code here. Cash payments have no reference, so the column is nullable.

  Included:
  - kubo.payment.payment_reference (varchar(100), nullable) and a partial
    unique index so one provider reference cannot be recorded twice.
  - fn_create_payment gains p_payment_reference; it is required for every
    method except Cash, trimmed, length-checked, and duplicate-checked.
  - The payment read/status/refund routines return the new column so every
    caller sees the same payment shape.

  Notes:
  - The response field is `payment_reference`, not `reference_code`; the latter
    is the reservation's reference code in the same payloads.
  - Refunds, Adjustments, and Reversals leave the column NULL.
  - A RETURNS TABLE change cannot use CREATE OR REPLACE, so each affected
    function is dropped with its exact identity signature first.
*/

CREATE SCHEMA IF NOT EXISTS kubo_payment_management;

DO $$
BEGIN
    IF to_regclass('kubo.payment') IS NULL
       OR to_regprocedure('kubo_payment_management.fn_get_payment_by_id(uuid)') IS NULL
       OR to_regprocedure('kubo_payment_management.fn_create_payment(uuid, uuid, numeric, kubo.payment_type, kubo.payment_method, uuid)') IS NULL THEN
        RAISE NOTICE 'Payment dependencies are not provisioned; skipping payment reference migration';
        RETURN;
    END IF;

    -------------------------------------------------------------------------
    -- Column and duplicate guard.
    -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'kubo'
          AND table_name = 'payment'
          AND column_name = 'payment_reference'
    ) THEN
        ALTER TABLE kubo.payment
            ADD COLUMN payment_reference character varying(100);
    END IF;

    CREATE UNIQUE INDEX IF NOT EXISTS payment_reference_unique
        ON kubo.payment (payment_reference)
        WHERE payment_reference IS NOT NULL;

    -------------------------------------------------------------------------
    -- Drop the affected routines so their RETURNS TABLE shapes can change.
    -------------------------------------------------------------------------
    EXECUTE $ddl$ DROP FUNCTION IF EXISTS kubo_payment_management.fn_get_payment_by_id(uuid) $ddl$;
    EXECUTE $ddl$ DROP FUNCTION IF EXISTS kubo_payment_management.fn_get_payments_by_reservation(uuid) $ddl$;
    EXECUTE $ddl$ DROP FUNCTION IF EXISTS kubo_payment_management.fn_get_payments(
        uuid, uuid, kubo.payment_status, kubo.payment_method,
        kubo.transaction_type, date, date, integer, integer
    ) $ddl$;
    EXECUTE $ddl$ DROP FUNCTION IF EXISTS kubo_payment_management.fn_get_payment_details_by_id(uuid) $ddl$;
    EXECUTE $ddl$ DROP FUNCTION IF EXISTS kubo_payment_management.fn_get_payment_details_by_reservation(uuid) $ddl$;
    EXECUTE $ddl$ DROP FUNCTION IF EXISTS kubo_payment_management.fn_get_payment_details(
        uuid, uuid, kubo.payment_status, kubo.payment_method,
        kubo.transaction_type, date, date, integer, integer
    ) $ddl$;
    EXECUTE $ddl$ DROP FUNCTION IF EXISTS kubo_payment_management.fn_create_payment(
        uuid, uuid, numeric, kubo.payment_type, kubo.payment_method, uuid
    ) $ddl$;
    EXECUTE $ddl$ DROP FUNCTION IF EXISTS kubo_payment_management.fn_update_payment_status(
        uuid, uuid, kubo.payment_status
    ) $ddl$;
    EXECUTE $ddl$ DROP FUNCTION IF EXISTS kubo_payment_management.fn_record_refund(
        uuid, uuid, uuid, numeric, kubo.payment_type, kubo.payment_method
    ) $ddl$;

    -------------------------------------------------------------------------
    -- Read routines.
    -------------------------------------------------------------------------
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_get_payment_by_id(
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
            payment_reference character varying
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            p.payment_id,
            p.reservation_id,
            r.reference_code,
            p.employee_id,
            (e.first_name || ' ' || e.last_name)::text,
            p.payment_amount,
            p.transaction_type,
            p.payment_type,
            p.payment_method,
            p.payment_status,
            p.payment_date,
            p.payment_reference
        FROM kubo.payment AS p
        JOIN kubo.reservation AS r ON r.reservation_id = p.reservation_id
        JOIN kubo.employee AS e ON e.employee_id = p.employee_id
        WHERE p.payment_id = p_payment_id;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_get_payments_by_reservation(
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
            payment_reference character varying
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            p.payment_id,
            p.reservation_id,
            r.reference_code,
            p.employee_id,
            (e.first_name || ' ' || e.last_name)::text,
            p.payment_amount,
            p.transaction_type,
            p.payment_type,
            p.payment_method,
            p.payment_status,
            p.payment_date,
            p.payment_reference
        FROM kubo.payment AS p
        JOIN kubo.reservation AS r ON r.reservation_id = p.reservation_id
        JOIN kubo.employee AS e ON e.employee_id = p.employee_id
        WHERE p.reservation_id = p_reservation_id
        ORDER BY p.payment_date, p.payment_id;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_get_payments(
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
            payment_reference character varying
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            p.payment_id,
            p.reservation_id,
            r.reference_code,
            p.employee_id,
            (e.first_name || ' ' || e.last_name)::text,
            p.payment_amount,
            p.transaction_type,
            p.payment_type,
            p.payment_method,
            p.payment_status,
            p.payment_date,
            p.payment_reference
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
    $sql$;

    EXECUTE $sql$
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
            related_charge_id uuid,
            payment_reference character varying
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            p.payment_id,
            p.reservation_id,
            r.reference_code,
            p.employee_id,
            (e.first_name || ' ' || e.last_name)::text,
            p.payment_amount,
            p.transaction_type,
            p.payment_type,
            p.payment_method,
            p.payment_status,
            p.payment_date,
            p.description,
            p.related_payment_id,
            p.related_charge_id,
            p.payment_reference
        FROM kubo.payment AS p
        JOIN kubo.reservation AS r ON r.reservation_id = p.reservation_id
        JOIN kubo.employee AS e ON e.employee_id = p.employee_id
        WHERE p.payment_id = p_payment_id;
        $function$
    $sql$;

    EXECUTE $sql$
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
            related_charge_id uuid,
            payment_reference character varying
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            p.payment_id,
            p.reservation_id,
            r.reference_code,
            p.employee_id,
            (e.first_name || ' ' || e.last_name)::text,
            p.payment_amount,
            p.transaction_type,
            p.payment_type,
            p.payment_method,
            p.payment_status,
            p.payment_date,
            p.description,
            p.related_payment_id,
            p.related_charge_id,
            p.payment_reference
        FROM kubo.payment AS p
        JOIN kubo.reservation AS r ON r.reservation_id = p.reservation_id
        JOIN kubo.employee AS e ON e.employee_id = p.employee_id
        WHERE p.reservation_id = p_reservation_id
        ORDER BY p.payment_date, p.payment_id;
        $function$
    $sql$;

    EXECUTE $sql$
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
            related_charge_id uuid,
            payment_reference character varying
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            p.payment_id,
            p.reservation_id,
            r.reference_code,
            p.employee_id,
            (e.first_name || ' ' || e.last_name)::text,
            p.payment_amount,
            p.transaction_type,
            p.payment_type,
            p.payment_method,
            p.payment_status,
            p.payment_date,
            p.description,
            p.related_payment_id,
            p.related_charge_id,
            p.payment_reference
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
    $sql$;

    -------------------------------------------------------------------------
    -- Staff payment creation, now storing the provider reference.
    -------------------------------------------------------------------------
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_create_payment(
            p_reservation_id uuid,
            p_employee_id uuid,
            p_payment_amount numeric,
            p_payment_type kubo.payment_type,
            p_payment_method kubo.payment_method,
            p_overpayment_approval_id uuid DEFAULT NULL,
            p_payment_reference varchar DEFAULT NULL
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
            payment_reference character varying
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_res_status kubo.reservation_status;
            v_balance numeric;
            v_payment_id uuid;
            v_approval kubo.overpayment_approval%ROWTYPE;
            v_uses_approval boolean := false;
            v_payment_reference text;
        BEGIN
            IF NOT kubo_payment_management.fn_is_active_staff(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Staff member may record payments.'
                    USING ERRCODE = '42501';
            END IF;

            IF p_payment_amount IS NULL OR p_payment_amount < 0
               OR p_payment_amount <> round(p_payment_amount, 2) THEN
                RAISE EXCEPTION 'Payment amount must be non-negative with at most two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_payment_type IS NULL OR p_payment_method IS NULL THEN
                RAISE EXCEPTION 'Payment type and method are required.'
                    USING ERRCODE = '22023';
            END IF;

            v_payment_reference := NULLIF(btrim(p_payment_reference), '');

            IF p_payment_method <> 'Cash' AND v_payment_reference IS NULL THEN
                RAISE EXCEPTION 'A reference code is required for % payments.', p_payment_method
                    USING ERRCODE = '22023';
            END IF;

            IF length(v_payment_reference) > 100 THEN
                RAISE EXCEPTION 'Payment reference cannot exceed 100 characters.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_payment_reference IS NOT NULL AND EXISTS (
                SELECT 1 FROM kubo.payment AS p
                WHERE p.payment_reference = v_payment_reference
            ) THEN
                RAISE EXCEPTION 'Payment reference % has already been recorded.', v_payment_reference
                    USING ERRCODE = '23505';
            END IF;

            SELECT r.status INTO v_res_status
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR SHARE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_res_status NOT IN ('Pending', 'Confirmed', 'CheckedIn', 'CheckedOut') THEN
                RAISE EXCEPTION 'Payments cannot be recorded for a % reservation.', v_res_status
                    USING ERRCODE = '23514';
            END IF;

            SELECT b.outstanding_balance INTO v_balance
            FROM kubo_reservation_management.fn_get_reservation_balance(p_reservation_id) AS b;

            IF p_payment_amount > v_balance THEN
                IF p_overpayment_approval_id IS NULL THEN
                    RAISE EXCEPTION 'Payment exceeds the outstanding balance of %. An Administrator overpayment approval is required.', v_balance
                        USING ERRCODE = '23514';
                END IF;

                SELECT * INTO v_approval
                FROM kubo.overpayment_approval AS o
                WHERE o.approval_id = p_overpayment_approval_id
                FOR UPDATE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Overpayment approval does not exist.'
                        USING ERRCODE = 'P0002';
                END IF;

                IF v_approval.reservation_id <> p_reservation_id THEN
                    RAISE EXCEPTION 'Overpayment approval belongs to another reservation.'
                        USING ERRCODE = '23514';
                END IF;

                IF v_approval.revoked_at IS NOT NULL OR v_approval.payment_id IS NOT NULL THEN
                    RAISE EXCEPTION 'Overpayment approval is no longer available.'
                        USING ERRCODE = '23514';
                END IF;

                IF p_payment_amount - v_balance > v_approval.max_overpayment_amount THEN
                    RAISE EXCEPTION 'Payment exceeds the outstanding balance of % by more than the approved %.',
                        v_balance, v_approval.max_overpayment_amount
                        USING ERRCODE = '23514';
                END IF;

                v_uses_approval := true;
            END IF;

            INSERT INTO kubo.payment AS p (
                reservation_id,
                employee_id,
                payment_amount,
                transaction_type,
                payment_type,
                payment_method,
                payment_status,
                payment_reference
            )
            VALUES (
                p_reservation_id,
                p_employee_id,
                p_payment_amount,
                'Payment',
                p_payment_type,
                p_payment_method,
                'Pending',
                v_payment_reference
            )
            RETURNING p.payment_id INTO v_payment_id;

            IF v_uses_approval THEN
                UPDATE kubo.overpayment_approval AS o
                SET payment_id = v_payment_id
                WHERE o.approval_id = v_approval.approval_id;
            END IF;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Create'::kubo.audit_action,
                'payment',
                v_payment_id,
                CASE WHEN v_uses_approval
                     THEN format('Recorded payment of %s exceeding the balance of %s under overpayment approval %s',
                                 p_payment_amount, v_balance, v_approval.approval_id)
                     ELSE format('Recorded payment of %s', p_payment_amount)
                END,
                NULL,
                (SELECT to_json(p) FROM kubo.payment AS p WHERE p.payment_id = v_payment_id)
            );

            RETURN QUERY
            SELECT * FROM kubo_payment_management.fn_get_payment_by_id(v_payment_id);
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Status transitions: completion honors the linked approval; failure or
    -- cancellation releases it. The reference code is immutable here.
    -------------------------------------------------------------------------
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_update_payment_status(
            p_payment_id uuid,
            p_employee_id uuid,
            p_payment_status kubo.payment_status
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
            payment_reference character varying
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_payment kubo.payment%ROWTYPE;
            v_balance numeric;
            v_approval kubo.overpayment_approval%ROWTYPE;
        BEGIN
            IF NOT kubo_payment_management.fn_is_active_staff(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Staff member may update payment status.'
                    USING ERRCODE = '42501';
            END IF;

            SELECT * INTO v_payment
            FROM kubo.payment AS p
            WHERE p.payment_id = p_payment_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Payment does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF p_payment_status IS NULL THEN
                RAISE EXCEPTION 'Target payment status is required.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_payment.payment_status = p_payment_status THEN
                RETURN QUERY
                SELECT * FROM kubo_payment_management.fn_get_payment_by_id(p_payment_id);
                RETURN;
            END IF;

            SELECT * INTO v_approval
            FROM kubo.overpayment_approval AS o
            WHERE o.payment_id = p_payment_id
            FOR UPDATE;

            IF p_payment_status = 'Completed' THEN
                IF v_payment.payment_status NOT IN ('Pending', 'Processing') THEN
                    RAISE EXCEPTION 'Only Pending or Processing payments can be completed.'
                        USING ERRCODE = '23514';
                END IF;

                SELECT b.outstanding_balance INTO v_balance
                FROM kubo_reservation_management.fn_get_reservation_balance(v_payment.reservation_id) AS b;

                IF v_payment.payment_amount > v_balance THEN
                    IF v_approval.approval_id IS NULL THEN
                        RAISE EXCEPTION 'Payment exceeds the outstanding balance of %.', v_balance
                            USING ERRCODE = '23514';
                    END IF;

                    IF v_payment.payment_amount - v_balance > v_approval.max_overpayment_amount THEN
                        RAISE EXCEPTION 'Payment exceeds the outstanding balance of % by more than the approved %.',
                            v_balance, v_approval.max_overpayment_amount
                            USING ERRCODE = '23514';
                    END IF;
                END IF;
            ELSIF v_payment.payment_status = 'Pending'
                  AND p_payment_status IN ('Processing', 'Failed', 'Cancelled') THEN
                NULL;
            ELSIF v_payment.payment_status = 'Processing'
                  AND p_payment_status IN ('Failed', 'Cancelled') THEN
                NULL;
            ELSE
                RAISE EXCEPTION 'Invalid payment status transition from % to %.',
                    v_payment.payment_status, p_payment_status
                    USING ERRCODE = '23514';
            END IF;

            UPDATE kubo.payment AS p
            SET payment_status = p_payment_status
            WHERE p.payment_id = p_payment_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Update'::kubo.audit_action,
                'payment',
                p_payment_id,
                format('Changed payment status from %s to %s', v_payment.payment_status, p_payment_status),
                to_json(v_payment),
                (SELECT to_json(p) FROM kubo.payment AS p WHERE p.payment_id = p_payment_id)
            );

            IF p_payment_status IN ('Failed', 'Cancelled') AND v_approval.approval_id IS NOT NULL THEN
                UPDATE kubo.overpayment_approval AS o
                SET payment_id = NULL
                WHERE o.approval_id = v_approval.approval_id;

                PERFORM kubo_audit_management.write_audit_log(
                    p_employee_id,
                    'Update'::kubo.audit_action,
                    'overpayment_approval',
                    v_approval.approval_id,
                    format('Released overpayment approval after payment %s became %s', p_payment_id, p_payment_status),
                    to_json(v_approval),
                    (SELECT to_json(o) FROM kubo.overpayment_approval AS o WHERE o.approval_id = v_approval.approval_id)
                );
            END IF;

            RETURN QUERY
            SELECT * FROM kubo_payment_management.fn_get_payment_by_id(p_payment_id);
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Refunds keep their existing rules; the new column stays NULL.
    -------------------------------------------------------------------------
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_record_refund(
            p_reservation_id uuid,
            p_employee_id uuid,
            p_original_payment_id uuid,
            p_payment_amount numeric,
            p_payment_type kubo.payment_type,
            p_payment_method kubo.payment_method
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
            payment_reference character varying
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_original kubo.payment%ROWTYPE;
            v_res_status kubo.reservation_status;
            v_net_paid numeric;
            v_refund_id uuid;
            v_prior_refunded numeric;
            v_refunded_total numeric;
            v_new_original_status kubo.payment_status;
        BEGIN
            IF NOT kubo_payment_management.fn_is_active_staff(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Staff member may record refunds.'
                    USING ERRCODE = '42501';
            END IF;

            IF p_payment_amount IS NULL OR p_payment_amount <= 0
               OR p_payment_amount <> round(p_payment_amount, 2) THEN
                RAISE EXCEPTION 'Refund amount must be positive with at most two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_payment_type IS NULL OR p_payment_method IS NULL THEN
                RAISE EXCEPTION 'Payment type and method are required.'
                    USING ERRCODE = '22023';
            END IF;

            SELECT * INTO v_original
            FROM kubo.payment AS p
            WHERE p.payment_id = p_original_payment_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Original payment does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_original.reservation_id <> p_reservation_id THEN
                RAISE EXCEPTION 'Original payment does not belong to this reservation.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_original.transaction_type <> 'Payment'
               OR v_original.payment_status NOT IN ('Completed', 'PartiallyRefunded') THEN
                RAISE EXCEPTION 'Refunds require a completed original payment.'
                    USING ERRCODE = '23514';
            END IF;

            SELECT r.status INTO v_res_status
            FROM kubo.reservation AS r
            WHERE r.reservation_id = p_reservation_id
            FOR SHARE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reservation does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            SELECT b.net_paid INTO v_net_paid
            FROM kubo_reservation_management.fn_get_reservation_balance(p_reservation_id) AS b;

            IF p_payment_amount > v_net_paid THEN
                RAISE EXCEPTION 'Refund exceeds the net amount paid of %.', v_net_paid
                    USING ERRCODE = '23514';
            END IF;

            SELECT COALESCE(SUM(r.payment_amount), 0)
            INTO v_prior_refunded
            FROM kubo.payment AS r
            WHERE r.related_payment_id = p_original_payment_id
              AND r.transaction_type = 'Refund'
              AND r.payment_status = 'Completed';

            v_refunded_total := v_prior_refunded + p_payment_amount;

            IF v_refunded_total > v_original.payment_amount THEN
                RAISE EXCEPTION 'Refund exceeds the unrefunded amount of this payment (%).',
                    v_original.payment_amount - v_prior_refunded
                    USING ERRCODE = '23514';
            END IF;

            INSERT INTO kubo.payment AS p (
                reservation_id,
                employee_id,
                payment_amount,
                transaction_type,
                payment_type,
                payment_method,
                payment_status,
                related_payment_id
            )
            VALUES (
                p_reservation_id,
                p_employee_id,
                p_payment_amount,
                'Refund',
                p_payment_type,
                p_payment_method,
                'Completed',
                p_original_payment_id
            )
            RETURNING p.payment_id INTO v_refund_id;

            IF v_refunded_total >= v_original.payment_amount THEN
                v_new_original_status := 'Refunded';
            ELSE
                v_new_original_status := 'PartiallyRefunded';
            END IF;

            UPDATE kubo.payment AS p
            SET payment_status = v_new_original_status
            WHERE p.payment_id = p_original_payment_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Create'::kubo.audit_action,
                'payment',
                v_refund_id,
                format('Recorded refund of %s against payment %s', p_payment_amount, p_original_payment_id),
                NULL,
                (SELECT to_json(p) FROM kubo.payment AS p WHERE p.payment_id = v_refund_id)
            );

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Update'::kubo.audit_action,
                'payment',
                p_original_payment_id,
                format('Original payment status changed to %s after refund', v_new_original_status),
                to_json(v_original),
                (SELECT to_json(p) FROM kubo.payment AS p WHERE p.payment_id = p_original_payment_id)
            );

            RETURN QUERY
            SELECT * FROM kubo_payment_management.fn_get_payment_by_id(v_refund_id);
        END;
        $function$
    $sql$;
END;
$$;
