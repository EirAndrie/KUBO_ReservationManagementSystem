/*
  Migration: 20261116_refine_daily_summary_report.sql
  ---------------------------------------------------
  Follow-up to 20261116_add_daily_summary_report.sql (code review).

  Problems fixed:
  - Early check-outs: an assignment checked out before its scheduled
    check_out_date still counted as booked on the later nights, and its
    departure appeared on the scheduled day instead of the day the guest left.
  - Overstays: a guest still CheckedIn after their check_out_date appeared in no
    report, and their kubo was not counted as booked.
  - fn_get_daily_collections repeated each status rule several times; rows are
    now classified once (same results).

  Rules (a "day" is a calendar date in Asia/Manila; NULL p_date = today):
  - Departure day of an assignment: the actual check-out date when it is
    CheckedOut with actual_check_out_datetime set; otherwise check_out_date.
  - Departures for a day: assignments (Reserved, CheckedIn, or CheckedOut; not
    on a Cancelled/NoShow reservation) whose departure day is that day, plus,
    only in today's report, CheckedIn assignments whose check_out_date has
    passed (overdue = true).
  - Booked for the night of a day: check_in_date <= day < departure day, or an
    overdue CheckedIn assignment in today's report.
  - fn_get_daily_occupancy.departures equals the departures row count.

  fn_get_daily_departures gains an `overdue` column, so it is dropped and
  recreated. The other two keep their signatures.
*/

DO $$
BEGIN
    IF to_regclass('kubo.payment') IS NULL
       OR to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL
       OR to_regclass('kubo.kubo') IS NULL
       OR to_regclass('kubo.guest') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_get_reservation_balance(uuid)') IS NULL THEN
        RAISE NOTICE 'Payment or reservation routines are not provisioned; skipping daily summary refinement';
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
        WITH classified AS (
            SELECT
                p.payment_method,
                p.payment_amount,
                CASE
                    WHEN p.transaction_type = 'Payment'
                         AND p.payment_status IN ('Completed', 'PartiallyRefunded', 'Refunded')
                        THEN 'collected'
                    WHEN p.transaction_type = 'Refund' AND p.payment_status = 'Completed'
                        THEN 'refunded'
                    WHEN p.transaction_type = 'Payment'
                         AND p.payment_status IN ('Pending', 'Processing')
                        THEN 'pending'
                END AS kind
            FROM kubo.payment AS p
            WHERE (p.payment_date AT TIME ZONE 'Asia/Manila')::date
                  = COALESCE(p_date, (now() AT TIME ZONE 'Asia/Manila')::date)
        ),
        per_method AS (
            SELECT
                c.payment_method,
                COUNT(*) FILTER (WHERE c.kind = 'collected')::integer AS payments_count,
                COALESCE(SUM(c.payment_amount) FILTER (WHERE c.kind = 'collected'), 0)::numeric AS collected,
                COUNT(*) FILTER (WHERE c.kind = 'refunded')::integer AS refunds_count,
                COALESCE(SUM(c.payment_amount) FILTER (WHERE c.kind = 'refunded'), 0)::numeric AS refunded,
                COUNT(*) FILTER (WHERE c.kind = 'pending')::integer AS pending_count,
                COALESCE(SUM(c.payment_amount) FILTER (WHERE c.kind = 'pending'), 0)::numeric AS pending_amount
            FROM classified AS c
            WHERE c.kind IS NOT NULL
            GROUP BY c.payment_method
        )
        SELECT
            m.payment_method,
            m.payments_count,
            m.collected,
            m.refunds_count,
            m.refunded,
            (m.collected - m.refunded)::numeric AS net,
            m.pending_count,
            m.pending_amount
        FROM per_method AS m
        ORDER BY m.payment_method;
        $function$
    $sql$;

    EXECUTE $sql$
        DROP FUNCTION IF EXISTS kubo_reservation_management.fn_get_daily_departures(date)
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
            overdue boolean,
            outstanding_balance numeric
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        WITH day AS (
            SELECT
                COALESCE(p_date, (now() AT TIME ZONE 'Asia/Manila')::date) AS d,
                (now() AT TIME ZONE 'Asia/Manila')::date AS today
        ),
        assignments AS (
            SELECT
                rk.*,
                CASE
                    WHEN rk.status = 'CheckedOut' AND rk.actual_check_out_datetime IS NOT NULL
                        THEN (rk.actual_check_out_datetime AT TIME ZONE 'Asia/Manila')::date
                    ELSE rk.check_out_date
                END AS departure_day
            FROM kubo.reserved_kubo AS rk
            JOIN kubo.reservation AS r ON r.reservation_id = rk.reservation_id
            WHERE rk.status IN ('Reserved', 'CheckedIn', 'CheckedOut')
              AND r.status NOT IN ('Cancelled', 'NoShow')
        ),
        due AS (
            SELECT
                a.*,
                (a.status = 'CheckedIn' AND a.check_out_date < day.d) AS overdue
            FROM assignments AS a, day
            WHERE a.departure_day = day.d
               OR (day.d = day.today AND a.status = 'CheckedIn' AND a.check_out_date < day.d)
        )
        SELECT
            r.reservation_id,
            r.reference_code,
            g.first_name || ' ' || g.last_name AS guest_name,
            due.kubo_id,
            k.kubo_number,
            due.check_out_date,
            due.scheduled_check_out_time,
            due.status AS assignment_status,
            due.actual_check_out_datetime,
            due.overdue,
            b.outstanding_balance
        FROM due
        JOIN kubo.reservation AS r ON r.reservation_id = due.reservation_id
        JOIN kubo.guest AS g ON g.guest_id = r.guest_id
        JOIN kubo.kubo AS k ON k.kubo_id = due.kubo_id
        CROSS JOIN LATERAL kubo_reservation_management.fn_get_reservation_balance(
            r.reservation_id
        ) AS b
        ORDER BY
            due.overdue DESC,
            (due.status = 'CheckedOut'),
            due.scheduled_check_out_time NULLS LAST,
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
            SELECT
                COALESCE(p_date, (now() AT TIME ZONE 'Asia/Manila')::date) AS d,
                (now() AT TIME ZONE 'Asia/Manila')::date AS today
        ),
        active AS (
            SELECT
                rk.*,
                CASE
                    WHEN rk.status = 'CheckedOut' AND rk.actual_check_out_datetime IS NOT NULL
                        THEN (rk.actual_check_out_datetime AT TIME ZONE 'Asia/Manila')::date
                    ELSE rk.check_out_date
                END AS departure_day
            FROM kubo.reserved_kubo AS rk
            JOIN kubo.reservation AS r ON r.reservation_id = rk.reservation_id
            WHERE rk.status IN ('Reserved', 'CheckedIn', 'CheckedOut')
              AND r.status NOT IN ('Cancelled', 'NoShow')
        )
        SELECT
            day.d AS report_date,
            (SELECT COUNT(*) FROM kubo.kubo)::integer AS total_kubos,
            (SELECT COUNT(DISTINCT a.kubo_id) FROM active AS a
             WHERE (a.check_in_date <= day.d AND a.departure_day > day.d)
                OR (day.d = day.today AND a.status = 'CheckedIn' AND a.check_out_date < day.d)
            )::integer AS booked_kubos,
            (SELECT COUNT(*) FROM active AS a WHERE a.check_in_date = day.d)::integer AS arrivals,
            (SELECT COUNT(*) FROM active AS a
             WHERE a.departure_day = day.d
                OR (day.d = day.today AND a.status = 'CheckedIn' AND a.check_out_date < day.d)
            )::integer AS departures
        FROM day;
        $function$
    $sql$;
END $$;
