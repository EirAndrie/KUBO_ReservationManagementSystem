/*
  Migration: 20261114_add_overpayment_approval.sql
  -------------------------------------------------
  Implements BR-053: a payment may exceed the outstanding balance only with an
  explicit, audited Administrator approval.

  Per BR-005 the approval is an authorization only; the Administrator does not
  record the payment. The flow is:

  1. An Administrator records an approval for one reservation with a maximum
     excess amount and a required reason (audited as `Approve`).
  2. Staff record the payment and pass `p_overpayment_approval_id`. If the
     amount exceeds the outstanding balance, the approval must belong to the
     reservation, be unused and unrevoked, and cover the excess. The approval
     is consumed by (linked to) that payment.
  3. Completing the payment re-checks the excess against the linked approval,
     because other payments may have changed the balance in between.
  4. If the payment fails or is cancelled, the approval is released so it can
     be used again. An unused approval can be revoked (audited as `Cancel`).

  The resulting negative outstanding balance is a guest credit (BR-047); the
  check-out guard still requires a zero balance, so Staff refund the credit.

  Included:
  - kubo.overpayment_approval table.
  - fn_create_overpayment_approval, fn_revoke_overpayment_approval,
    fn_get_overpayment_approvals.
  - fn_create_payment gains `p_overpayment_approval_id uuid DEFAULT NULL`
    (old 5-argument signature dropped to avoid an ambiguous overload).
  - fn_update_payment_status honors and releases linked approvals.
*/

DO $$
BEGIN
    IF to_regclass('kubo.payment') IS NULL
       OR to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.employee') IS NULL
       OR to_regprocedure('kubo_payment_management.fn_is_active_staff(uuid)') IS NULL
       OR to_regprocedure('kubo_payment_management.fn_is_active_administrator(uuid)') IS NULL
       OR to_regprocedure('kubo_payment_management.fn_get_payment_by_id(uuid)') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_get_reservation_balance(uuid)') IS NULL
       OR to_regprocedure('kubo_audit_management.write_audit_log(uuid,kubo.audit_action,character varying,uuid,text,json,json)') IS NULL THEN
        RAISE NOTICE 'Payment schema is not provisioned; skipping overpayment approval';
        RETURN;
    END IF;

    EXECUTE $ddl$
        CREATE TABLE IF NOT EXISTS kubo.overpayment_approval (
            approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            reservation_id uuid NOT NULL
                REFERENCES kubo.reservation(reservation_id) ON DELETE CASCADE,
            approved_by uuid NOT NULL
                REFERENCES kubo.employee(employee_id) ON DELETE RESTRICT,
            max_overpayment_amount numeric(10,2) NOT NULL
                CONSTRAINT overpayment_approval_amount_check
                CHECK (max_overpayment_amount > 0),
            reason varchar(255) NOT NULL
                CONSTRAINT overpayment_approval_reason_check
                CHECK (length(btrim(reason)) > 0),
            payment_id uuid UNIQUE
                REFERENCES kubo.payment(payment_id) ON DELETE SET NULL,
            revoked_by uuid
                REFERENCES kubo.employee(employee_id) ON DELETE RESTRICT,
            revoked_at timestamp with time zone,
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            CONSTRAINT overpayment_approval_revoked_unused_check
                CHECK (revoked_at IS NULL OR payment_id IS NULL),
            CONSTRAINT overpayment_approval_revoked_pair_check
                CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
        )
    $ddl$;

    EXECUTE $ddl$
        CREATE INDEX IF NOT EXISTS overpayment_approval_reservation_idx
            ON kubo.overpayment_approval (reservation_id)
    $ddl$;

    -------------------------------------------------------------------------
    -- Read model: approvals for one reservation with a derived status.
    -------------------------------------------------------------------------
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_get_overpayment_approvals(
            p_reservation_id uuid
        )
        RETURNS TABLE(
            approval_id uuid,
            reservation_id uuid,
            approved_by uuid,
            approved_by_name text,
            max_overpayment_amount numeric,
            reason character varying,
            status text,
            payment_id uuid,
            revoked_by uuid,
            revoked_by_name text,
            revoked_at timestamp with time zone,
            created_at timestamp with time zone
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            o.approval_id,
            o.reservation_id,
            o.approved_by,
            (a.first_name || ' ' || a.last_name)::text,
            o.max_overpayment_amount,
            o.reason,
            CASE
                WHEN o.revoked_at IS NOT NULL THEN 'Revoked'
                WHEN o.payment_id IS NOT NULL THEN 'Used'
                ELSE 'Available'
            END,
            o.payment_id,
            o.revoked_by,
            CASE WHEN r.employee_id IS NULL THEN NULL
                 ELSE (r.first_name || ' ' || r.last_name)::text END,
            o.revoked_at,
            o.created_at
        FROM kubo.overpayment_approval AS o
        JOIN kubo.employee AS a ON a.employee_id = o.approved_by
        LEFT JOIN kubo.employee AS r ON r.employee_id = o.revoked_by
        WHERE o.reservation_id = p_reservation_id
        ORDER BY o.created_at DESC, o.approval_id;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Administrator records an approval (authorization only, BR-005).
    -------------------------------------------------------------------------
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_create_overpayment_approval(
            p_reservation_id uuid,
            p_employee_id uuid,
            p_max_overpayment_amount numeric,
            p_reason character varying
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_res_status kubo.reservation_status;
            v_approval_id uuid;
        BEGIN
            IF NOT kubo_payment_management.fn_is_active_administrator(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Administrator may approve an overpayment.'
                    USING ERRCODE = '42501';
            END IF;

            IF p_max_overpayment_amount IS NULL OR p_max_overpayment_amount <= 0
               OR p_max_overpayment_amount <> round(p_max_overpayment_amount, 2) THEN
                RAISE EXCEPTION 'Approved overpayment must be positive with at most two decimal places.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_reason IS NULL OR btrim(p_reason) = '' THEN
                RAISE EXCEPTION 'A reason is required to approve an overpayment.'
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
                RAISE EXCEPTION 'Overpayments cannot be approved for a % reservation.', v_res_status
                    USING ERRCODE = '23514';
            END IF;

            INSERT INTO kubo.overpayment_approval AS o (
                reservation_id, approved_by, max_overpayment_amount, reason
            )
            VALUES (
                p_reservation_id, p_employee_id, p_max_overpayment_amount, btrim(p_reason)
            )
            RETURNING o.approval_id INTO v_approval_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Approve'::kubo.audit_action,
                'overpayment_approval',
                v_approval_id,
                format('Approved an overpayment of up to %s for reservation %s: %s',
                       p_max_overpayment_amount, p_reservation_id, btrim(p_reason)),
                NULL,
                (SELECT to_json(o) FROM kubo.overpayment_approval AS o WHERE o.approval_id = v_approval_id)
            );

            RETURN v_approval_id;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Administrator revokes an approval that has not been used.
    -------------------------------------------------------------------------
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_revoke_overpayment_approval(
            p_approval_id uuid,
            p_employee_id uuid
        )
        RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_old kubo.overpayment_approval%ROWTYPE;
        BEGIN
            IF NOT kubo_payment_management.fn_is_active_administrator(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Administrator may revoke an overpayment approval.'
                    USING ERRCODE = '42501';
            END IF;

            SELECT * INTO v_old
            FROM kubo.overpayment_approval AS o
            WHERE o.approval_id = p_approval_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Overpayment approval does not exist.'
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_old.revoked_at IS NOT NULL THEN
                RAISE EXCEPTION 'This overpayment approval is already revoked.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_old.payment_id IS NOT NULL THEN
                RAISE EXCEPTION 'This overpayment approval is already used by a payment.'
                    USING ERRCODE = '23514';
            END IF;

            UPDATE kubo.overpayment_approval AS o
            SET revoked_at = now(), revoked_by = p_employee_id
            WHERE o.approval_id = p_approval_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Cancel'::kubo.audit_action,
                'overpayment_approval',
                p_approval_id,
                'Revoked an unused overpayment approval',
                to_json(v_old),
                (SELECT to_json(o) FROM kubo.overpayment_approval AS o WHERE o.approval_id = p_approval_id)
            );

            RETURN v_old.reservation_id;
        END;
        $function$
    $sql$;

    -------------------------------------------------------------------------
    -- Staff payment creation, now honoring an approval for the excess.
    -------------------------------------------------------------------------
    EXECUTE $ddl$
        DROP FUNCTION IF EXISTS kubo_payment_management.fn_create_payment(
            uuid, uuid, numeric, kubo.payment_type, kubo.payment_method
        )
    $ddl$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_create_payment(
            p_reservation_id uuid,
            p_employee_id uuid,
            p_payment_amount numeric,
            p_payment_type kubo.payment_type,
            p_payment_method kubo.payment_method,
            p_overpayment_approval_id uuid DEFAULT NULL
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
            v_approval kubo.overpayment_approval%ROWTYPE;
            v_uses_approval boolean := false;
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
    -- cancellation releases it.
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
            payment_date timestamp with time zone
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
END;
$$;
