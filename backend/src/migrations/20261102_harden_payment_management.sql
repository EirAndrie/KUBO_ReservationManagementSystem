/*
  Migration: 20261102_harden_payment_management.sql
  -------------------------------------------------
  Implements the payment module against the existing kubo.payment table.

  Included:
  - Staff payment creation with balance and reservation-state checks.
  - Pending payment completion and allowed status transitions.
  - Refunds against completed payments, with net-paid limits and original
    payment status updates.
  - Read/filter routines.
  - Cleanup-only payment deletion for development/repair use.
  - Audit writes using the shared audit routine and temporary actor.

  Adjustment/Reversal balance effects remain deferred because G-07 is unresolved.
*/

CREATE SCHEMA IF NOT EXISTS kubo_payment_management;

DO $$
BEGIN
    IF to_regclass('kubo.payment') IS NULL
       OR to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.employee') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_get_reservation_balance(uuid)') IS NULL THEN
        RAISE NOTICE 'Payment dependencies are not provisioned; skipping payment hardening';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_is_active_staff(
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
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_is_active_administrator(
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
            payment_date timestamp with time zone
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
            p.payment_date
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
            payment_date timestamp with time zone
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
            p.payment_date
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
            payment_date timestamp with time zone
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
            p.payment_date
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
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_create_payment(
            p_reservation_id uuid,
            p_employee_id uuid,
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
            payment_date timestamp with time zone
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_res_status kubo.reservation_status;
            v_balance numeric;
            v_payment_id uuid;
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
                RAISE EXCEPTION 'Payment exceeds the outstanding balance of %.', v_balance
                    USING ERRCODE = '23514';
            END IF;

            INSERT INTO kubo.payment AS p (
                reservation_id,
                employee_id,
                payment_amount,
                transaction_type,
                payment_type,
                payment_method,
                payment_status
            )
            VALUES (
                p_reservation_id,
                p_employee_id,
                p_payment_amount,
                'Payment',
                p_payment_type,
                p_payment_method,
                'Pending'
            )
            RETURNING p.payment_id INTO v_payment_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Create'::kubo.audit_action,
                'payment',
                v_payment_id,
                format('Recorded payment of %s', p_payment_amount),
                NULL,
                (SELECT to_json(p) FROM kubo.payment AS p WHERE p.payment_id = v_payment_id)
            );

            RETURN QUERY
            SELECT * FROM kubo_payment_management.fn_get_payment_by_id(v_payment_id);
        END;
        $function$
    $sql$;

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
            payment_date timestamp with time zone
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_payment kubo.payment%ROWTYPE;
            v_balance numeric;
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

            IF p_payment_status = 'Completed' THEN
                IF v_payment.payment_status NOT IN ('Pending', 'Processing') THEN
                    RAISE EXCEPTION 'Only Pending or Processing payments can be completed.'
                        USING ERRCODE = '23514';
                END IF;

                SELECT b.outstanding_balance INTO v_balance
                FROM kubo_reservation_management.fn_get_reservation_balance(v_payment.reservation_id) AS b;

                IF v_payment.payment_amount > v_balance THEN
                    RAISE EXCEPTION 'Payment exceeds the outstanding balance of %.', v_balance
                        USING ERRCODE = '23514';
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

            RETURN QUERY
            SELECT * FROM kubo_payment_management.fn_get_payment_by_id(p_payment_id);
        END;
        $function$
    $sql$;

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
            payment_date timestamp with time zone
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

            INSERT INTO kubo.payment AS p (
                reservation_id,
                employee_id,
                payment_amount,
                transaction_type,
                payment_type,
                payment_method,
                payment_status
            )
            VALUES (
                p_reservation_id,
                p_employee_id,
                p_payment_amount,
                'Refund',
                p_payment_type,
                p_payment_method,
                'Completed'
            )
            RETURNING p.payment_id INTO v_refund_id;

            -- The DDL has no original_payment_id column. Refund linkage is
            -- recorded in the audit description, so aggregate prior refunds
            -- from there to decide whether the original is fully refunded.
            SELECT COALESCE(SUM(r.payment_amount), 0)
            INTO v_prior_refunded
            FROM kubo.audit_log AS a
            JOIN kubo.payment AS r ON r.payment_id = a.entity_id
            WHERE a.entity_type = 'payment'
              AND a.action = 'Create'
              AND r.transaction_type = 'Refund'
              AND r.reservation_id = p_reservation_id
              AND a.description LIKE '%against payment ' || p_original_payment_id::text;

            v_refunded_total := v_prior_refunded + p_payment_amount;

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

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_delete_payment_cleanup(
            p_payment_id uuid,
            p_employee_id uuid
        )
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_old kubo.payment%ROWTYPE;
        BEGIN
            IF NOT kubo_payment_management.fn_is_active_administrator(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Administrator may use payment cleanup deletion.'
                    USING ERRCODE = '42501';
            END IF;

            SELECT * INTO v_old
            FROM kubo.payment AS p
            WHERE p.payment_id = p_payment_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RETURN FALSE;
            END IF;

            DELETE FROM kubo.payment AS p
            WHERE p.payment_id = p_payment_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Delete'::kubo.audit_action,
                'payment',
                p_payment_id,
                'Cleanup deletion of payment record',
                to_json(v_old),
                NULL
            );

            RETURN TRUE;
        END;
        $function$
    $sql$;
END $$;
