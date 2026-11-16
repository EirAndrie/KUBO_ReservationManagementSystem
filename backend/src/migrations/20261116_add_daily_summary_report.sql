/*
  Migration: 20261116_add_daily_summary_report.sql
  ------------------------------------------------
  Read-only routines for the Administrator end-of-day report
  (GET /reports/daily). Totals are computed in PostgreSQL so they stay correct
  on busy days instead of being summed from a 100-row page in the browser.

  "A day" is a calendar date in the resort time zone (Asia/Manila). A NULL
  p_date means today at the resort.

  Added:
  - kubo_payment_management.fn_get_daily_collections(p_date date)
    One row per payment method with activity on that day:
      collected  = Payment rows recorded that day whose status is Completed,
                   PartiallyRefunded, or Refunded (the same rule as net_paid in
                   fn_get_reservation_balance);
      refunded   = Completed Refund rows recorded that day;
      net        = collected - refunded;
      pending    = Payment rows recorded that day still Pending or Processing
                   (not collected).
    Adjustments and Reversals are non-cash charge corrections and are excluded.
    A payment is attributed to the day it was recorded (payment_date); the
    schema has no completion timestamp.

  - kubo_reservation_management.fn_get_daily_departures(p_date date)
    Assignments whose check_out_date is that day: Reserved (never checked in),
    CheckedIn (still to leave), or CheckedOut (already left), excluding
    Cancelled/NoShow reservations, with the reservation's derived
    outstanding_balance from fn_get_reservation_balance. Its row count equals
    fn_get_daily_occupancy's departures.

  - kubo_reservation_management.fn_get_daily_occupancy(p_date date)
    Kubos booked for the night of that day (check_in_date <= day <
    check_out_date), arrivals and departures that day, counting assignments and
    reservations that are not Cancelled or NoShow, plus the kubo count.
*/

DO $$
BEGIN
    IF to_regclass('kubo.payment') IS NULL
       OR to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL
       OR to_regclass('kubo.kubo') IS NULL
       OR to_regclass('kubo.guest') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_get_reservation_balance(uuid)') IS NULL THEN
        RAISE NOTICE 'Payment or reservation routines are not provisioned; skipping daily summary report';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_payment_management.fn_get_daily_collections(
            p_date date DEFAULT NULL
        )
        RETURNS TABLE(
            payment_method kubo.payment_method,
            payments_count integer,
            collected numeric,
            refunds_count integer,
            refunded numeric,
            net numeric,
            pending_count integer,
            pending_amount numeric
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        WITH day AS (
            SELECT COALESCE(p_date, (now() AT TIME ZONE 'Asia/Manila')::date) AS d
        ),
        rows_today AS (
            SELECT p.*
            FROM kubo.payment AS p, day
            WHERE (p.payment_date AT TIME ZONE 'Asia/Manila')::date = day.d
        )
        SELECT
            r.payment_method,
            COUNT(*) FILTER (
                WHERE r.transaction_type = 'Payment'
                  AND r.payment_status IN ('Completed', 'PartiallyRefunded', 'Refunded')
            )::integer AS payments_count,
            COALESCE(SUM(r.payment_amount) FILTER (
                WHERE r.transaction_type = 'Payment'
                  AND r.payment_status IN ('Completed', 'PartiallyRefunded', 'Refunded')
            ), 0)::numeric AS collected,
            COUNT(*) FILTER (
                WHERE r.transaction_type = 'Refund' AND r.payment_status = 'Completed'
            )::integer AS refunds_count,
            COALESCE(SUM(r.payment_amount) FILTER (
                WHERE r.transaction_type = 'Refund' AND r.payment_status = 'Completed'
            ), 0)::numeric AS refunded,
            (
                COALESCE(SUM(r.payment_amount) FILTER (
                    WHERE r.transaction_type = 'Payment'
                      AND r.payment_status IN ('Completed', 'PartiallyRefunded', 'Refunded')
                ), 0)
                - COALESCE(SUM(r.payment_amount) FILTER (
                    WHERE r.transaction_type = 'Refund' AND r.payment_status = 'Completed'
                ), 0)
            )::numeric AS net,
            COUNT(*) FILTER (
                WHERE r.transaction_type = 'Payment'
                  AND r.payment_status IN ('Pending', 'Processing')
            )::integer AS pending_count,
            COALESCE(SUM(r.payment_amount) FILTER (
                WHERE r.transaction_type = 'Payment'
                  AND r.payment_status IN ('Pending', 'Processing')
            ), 0)::numeric AS pending_amount
        FROM rows_today AS r
        WHERE r.transaction_type IN ('Payment', 'Refund')
        GROUP BY r.payment_method
        HAVING COUNT(*) FILTER (
            WHERE (r.transaction_type = 'Payment'
                   AND r.payment_status IN ('Completed', 'PartiallyRefunded', 'Refunded', 'Pending', 'Processing'))
               OR (r.transaction_type = 'Refund' AND r.payment_status = 'Completed')
        ) > 0
        ORDER BY r.payment_method;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_get_daily_departures(
            p_date date DEFAULT NULL
        )
        RETURNS TABLE(
            reservation_id uuid,
            reference_code character varying,
            guest_name text,
            kubo_id uuid,
            kubo_number character varying,
            check_out_date date,
            scheduled_check_out_time time without time zone,
            assignment_status kubo.reserved_kubo_status,
            actual_check_out_datetime timestamp with time zone,
            outstanding_balance numeric
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT
            r.reservation_id,
            r.reference_code,
            g.first_name || ' ' || g.last_name AS guest_name,
            rk.kubo_id,
            k.kubo_number,
            rk.check_out_date,
            rk.scheduled_check_out_time,
            rk.status AS assignment_status,
            rk.actual_check_out_datetime,
            b.outstanding_balance
        FROM kubo.reserved_kubo AS rk
        JOIN kubo.reservation AS r ON r.reservation_id = rk.reservation_id
        JOIN kubo.guest AS g ON g.guest_id = r.guest_id
        JOIN kubo.kubo AS k ON k.kubo_id = rk.kubo_id
        CROSS JOIN LATERAL kubo_reservation_management.fn_get_reservation_balance(
            r.reservation_id
        ) AS b
        WHERE rk.check_out_date = COALESCE(p_date, (now() AT TIME ZONE 'Asia/Manila')::date)
          AND rk.status IN ('Reserved', 'CheckedIn', 'CheckedOut')
          AND r.status NOT IN ('Cancelled', 'NoShow')
        ORDER BY
            (rk.status = 'CheckedOut'),
            rk.scheduled_check_out_time NULLS LAST,
            k.kubo_number;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_get_daily_occupancy(
            p_date date DEFAULT NULL
        )
        RETURNS TABLE(
            report_date date,
            total_kubos integer,
            booked_kubos integer,
            arrivals integer,
            departures integer
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        WITH day AS (
            SELECT COALESCE(p_date, (now() AT TIME ZONE 'Asia/Manila')::date) AS d
        ),
        active AS (
            SELECT rk.*
            FROM kubo.reserved_kubo AS rk
            JOIN kubo.reservation AS r ON r.reservation_id = rk.reservation_id
            WHERE rk.status NOT IN ('Cancelled', 'NoShow')
              AND r.status NOT IN ('Cancelled', 'NoShow')
        )
        SELECT
            day.d AS report_date,
            (SELECT COUNT(*) FROM kubo.kubo)::integer AS total_kubos,
            (SELECT COUNT(DISTINCT a.kubo_id) FROM active AS a
             WHERE a.check_in_date <= day.d AND a.check_out_date > day.d)::integer AS booked_kubos,
            (SELECT COUNT(*) FROM active AS a WHERE a.check_in_date = day.d)::integer AS arrivals,
            (SELECT COUNT(*) FROM active AS a WHERE a.check_out_date = day.d)::integer AS departures
        FROM day;
        $function$
    $sql$;
END $$;
