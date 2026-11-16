/*
  Migration: 20261117_fix_guest_last_stay.sql
  -------------------------------------------
  Follow-up to 20261116_refine_guest_stay_stats.sql (code review of PR #121).
  The earlier files were applied on the test database and are not edited.

  Problem fixed:
  - last_stay was the latest stay start over every non-cancelled reservation,
    including Pending/Confirmed future bookings, so the guest list's "Last stay"
    column could show a date that has not happened yet. Upcoming bookings are
    already reported by the `upcoming` flag.

  Changed: kubo_guest_management.fn_get_guest_stay_stats(p_guest_ids uuid[])
  Same signature and columns. last_stay now counts only reservations whose stay
  actually started (status CheckedIn or CheckedOut). Every other column is
  unchanged. Also skips with a NOTICE when the kubo_guest_management schema is
  missing, like the other guest migrations.
*/

DO $$
BEGIN
    IF to_regnamespace('kubo_guest_management') IS NULL
       OR to_regclass('kubo.guest') IS NULL
       OR to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL THEN
        RAISE NOTICE 'Guest schema or reservation tables are not provisioned; skipping guest last-stay fix';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_guest_management.fn_get_guest_stay_stats(
            p_guest_ids uuid[]
        )
        RETURNS TABLE(
            guest_id uuid,
            reservations_count integer,
            stays integer,
            last_stay date,
            upcoming boolean,
            is_returning boolean
        )
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        WITH per_reservation AS (
            SELECT
                r.guest_id,
                r.status,
                (
                    SELECT min(rk.check_in_date)
                    FROM kubo.reserved_kubo AS rk
                    WHERE rk.reservation_id = r.reservation_id
                      AND rk.status NOT IN ('Cancelled', 'NoShow')
                ) AS stay_start
            FROM kubo.reservation AS r
            WHERE r.guest_id = ANY (p_guest_ids)
        )
        SELECT
            g.guest_id,
            COUNT(pr.guest_id)::integer AS reservations_count,
            COUNT(pr.guest_id) FILTER (
                WHERE pr.status NOT IN ('Cancelled', 'NoShow')
            )::integer AS stays,
            MAX(pr.stay_start) FILTER (
                WHERE pr.status IN ('CheckedIn', 'CheckedOut')
            ) AS last_stay,
            COALESCE(bool_or(
                pr.status IN ('Pending', 'Confirmed')
                AND pr.stay_start > (now() AT TIME ZONE 'Asia/Manila')::date
            ), false) AS upcoming,
            (
                COUNT(pr.guest_id) FILTER (
                    WHERE pr.status NOT IN ('Cancelled', 'NoShow')
                ) >= 2
                AND COUNT(pr.guest_id) FILTER (WHERE pr.status = 'CheckedOut') >= 1
            ) AS is_returning
        FROM kubo.guest AS g
        LEFT JOIN per_reservation AS pr ON pr.guest_id = g.guest_id
        WHERE g.guest_id = ANY (p_guest_ids)
        GROUP BY g.guest_id;
        $function$
    $sql$;
END $$;
