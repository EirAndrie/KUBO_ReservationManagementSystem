/*
  Migration: 20261102_fix_reservation_balance_refund_status.sql
  -------------------------------------------------------------
  Corrects kubo_reservation_management.fn_get_reservation_balance.

  BR-054 changes the original payment status to PartiallyRefunded or Refunded
  once a refund is recorded. The previous balance routine only counted
  Completed payments, so the original payment disappeared from net_paid and
  the refund was subtracted on its own, producing a negative or inflated
  balance.

  Net paid is the sum of completed payment/refund rows. Payments that were
  partially or fully refunded still count as money received; the refund rows
  offset them. No stored balance columns are introduced.
*/

DO $$
BEGIN
    IF to_regprocedure('kubo_reservation_management.fn_get_reservation_balance(uuid)') IS NULL THEN
        RAISE NOTICE 'Reservation balance routine is not provisioned; skipping balance correction';
        RETURN;
    END IF;

    EXECUTE $sql$
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
                ), 0)::numeric AS paid
        )
        SELECT
            a.accommodation AS accommodation_total,
            a.accommodation + a.charges AS charges_total,
            a.paid AS net_paid,
            (a.accommodation + a.charges - a.paid) AS outstanding_balance
        FROM amounts AS a;
        $function$
    $sql$;
END $$;
