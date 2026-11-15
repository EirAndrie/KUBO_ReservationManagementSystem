/*
  Migration: 20261116_minimum_payment_amount.sql
  -------------------------------------------------
  Rejects zero, negative, and tiny payment amounts. A Payment transaction must
  be at least 100.00, except when it exactly settles a remaining balance below
  that minimum. The exception lets the desk close a small final balance without
  forcing a credit and an overpayment approval.

  Included:
  - fn_create_payment: positive amounts only, plus the 100.00-or-exact-balance
    rule (the balance is known only after the reservation is locked).
  - fn_update_payment_status: completion re-checks the same rule so a legacy
    Pending row cannot be completed under the old rules.
  - payment_amount_positive_check: a NOT VALID backstop that rejects non-positive
    Payment rows while leaving Refunds, Adjustments, and Reversals untouched.

  Existing rows below 100.00 remain (the constraint is NOT VALID).
*/

DO $$
BEGIN
    IF to_regclass('kubo.payment') IS NULL
       OR to_regprocedure('kubo_payment_management.fn_create_payment(uuid, uuid, numeric, kubo.payment_type, kubo.payment_method, uuid, character varying)') IS NULL
       OR to_regprocedure('kubo_payment_management.fn_update_payment_status(uuid, uuid, kubo.payment_status)') IS NULL THEN
        RAISE NOTICE 'Payment dependencies are not provisioned; skipping minimum payment amount';
        RETURN;
    END IF;

    -------------------------------------------------------------------------
    -- Non-positive Payments are never valid; the 100.00 floor lives in the
    -- functions because it needs the reservation balance for the exception.
    -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'payment_amount_positive_check'
          AND conrelid = 'kubo.payment'::regclass
    ) THEN
        ALTER TABLE kubo.payment
            ADD CONSTRAINT payment_amount_positive_check
            CHECK (transaction_type <> 'Payment' OR payment_amount > 0)
            NOT VALID;
    END IF;

    -------------------------------------------------------------------------
    -- Staff payment creation.
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

            IF p_payment_amount IS NULL OR p_payment_amount <= 0
               OR p_payment_amount <> round(p_payment_amount, 2) THEN
                RAISE EXCEPTION 'Payment amount must be positive with at most two decimal places.'
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

            IF p_payment_amount < 100 AND p_payment_amount <> v_balance THEN
                RAISE EXCEPTION 'Payment amount must be at least 100.00 unless it settles the remaining balance of %.', v_balance
                    USING ERRCODE = '23514';
            END IF;

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
    -- Completion re-checks the amount so legacy Pending rows cannot bypass the
    -- minimum under the old rules.
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

                IF v_payment.payment_amount < 100 AND v_payment.payment_amount <> v_balance THEN
                    RAISE EXCEPTION 'Payment amount must be at least 100.00 unless it settles the remaining balance of %.', v_balance
                        USING ERRCODE = '23514';
                END IF;

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
END;
$$;
