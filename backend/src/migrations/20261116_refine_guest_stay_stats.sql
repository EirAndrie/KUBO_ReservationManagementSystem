/*
  Migration: 20261116_refine_guest_stay_stats.sql
  -----------------------------------------------
  Follow-up to 20261116_add_guest_stay_stats.sql (code review).

  Problems fixed:
  - A reservation's stay start used every assignment, including Cancelled and
    NoShow ones, so a cancelled earlier kubo could set last_stay and hide an
    upcoming stay that starts later.
  - is_returning was "2+ stays", so a new guest with two future bookings and
    no visit yet was marked Returning.

  Changed: kubo_guest_management.fn_get_guest_stay_stats(p_guest_ids uuid[])
  Same signature and columns. A reservation's stay starts at its earliest
  assignment that is not Cancelled or NoShow. is_returning is now: 2+ stays
  AND at least one CheckedOut reservation (the guest has stayed before and has
  booked again).
*/

DO $$
BEGIN
    IF to_regclass('kubo.guest') IS NULL
       OR to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL THEN
        RAISE NOTICE 'Guest or reservation tables are not provisioned; skipping guest stay stats refinement';
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
                WHERE pr.status NOT IN ('Cancelled', 'NoShow')
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
