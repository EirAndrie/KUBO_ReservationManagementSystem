/*
  Migration: 20261114_link_refunds_to_original_payment.sql
  -------------------------------------------------
  Replaces the audit-description refund linkage (BR-054) with a real column.

  `kubo.payment.related_payment_id` already exists (20261108) for Reversals.
  Refund rows now use it too, pointing at the original `Payment` row:

  - Backfill: existing Refund rows get related_payment_id from their
    "Recorded refund of X against payment <uuid>" audit description.
  - Constraint `payment_refund_link_check` (NOT VALID, so unlinkable legacy
    rows are tolerated) requires every new Refund to name its original payment.
  - fn_record_refund stores the link, sums prior refunds through it, and now
    also rejects a refund that would take the cumulative refunded amount above
    the original payment (previously only the reservation-wide net paid was
    checked, so one payment could be over-refunded).

  The audit description keeps its existing wording for traceability.
*/

DO $$
BEGIN
    IF to_regclass('kubo.payment') IS NULL
       OR to_regclass('kubo.audit_log') IS NULL
       OR to_regprocedure('kubo_payment_management.fn_get_payment_by_id(uuid)') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_get_reservation_balance(uuid)') IS NULL
       OR NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'kubo' AND table_name = 'payment'
              AND column_name = 'related_payment_id'
       ) THEN
        RAISE NOTICE 'Payment correction schema is not provisioned; skipping refund linkage';
        RETURN;
    END IF;

    -- Backfill legacy refunds from the audit description written by
    -- fn_record_refund ("... against payment <uuid>").
    UPDATE kubo.payment AS r
    SET related_payment_id = src.original_id
    FROM (
        SELECT DISTINCT ON (a.entity_id)
               a.entity_id AS refund_id,
               (substring(a.description FROM 'against payment ([0-9a-fA-F-]{36})$'))::uuid AS original_id
        FROM kubo.audit_log AS a
        WHERE a.entity_type = 'payment'
          AND a.action = 'Create'
          AND a.description ~ 'against payment [0-9a-fA-F-]{36}$'
        ORDER BY a.entity_id, a.created_at
    ) AS src
    JOIN kubo.payment AS o ON o.payment_id = src.original_id
    WHERE r.payment_id = src.refund_id
      AND r.transaction_type = 'Refund'
      AND r.related_payment_id IS NULL
      AND o.reservation_id = r.reservation_id;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'payment_refund_link_check'
          AND conrelid = 'kubo.payment'::regclass
    ) THEN
        ALTER TABLE kubo.payment
            ADD CONSTRAINT payment_refund_link_check
            CHECK (transaction_type <> 'Refund' OR related_payment_id IS NOT NULL)
            NOT VALID;
    END IF;

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
