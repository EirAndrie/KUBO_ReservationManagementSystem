/*
  Migration: 20261116_add_guest_stay_stats.sql
  --------------------------------------------
  Per-guest stay statistics for the guest list (Stays, Last stay, Returning
  badge, Upcoming filter, and delete eligibility).

  Problem fixed:
  - The guest list built these numbers in the browser from the latest 100
    reservations, so guests whose bookings were older showed 0 stays, no last
    stay, and an Administrator "Delete guest" action that the database would
    then refuse.

  Added: kubo_guest_management.fn_get_guest_stay_stats(p_guest_ids uuid[])
  One row per requested guest that exists (guests with no reservations get
  zeros):
  - reservations_count: every reservation, any status (a guest with any
    reservation cannot be deleted, BR-015);
  - stays: reservations not Cancelled or NoShow;
  - last_stay: the latest first check-in date among those stays (a
    reservation's stay starts at its earliest assignment check-in);
  - upcoming: some Pending or Confirmed reservation starts after today in the
    resort time zone (Asia/Manila);
  - is_returning: stays >= 2 (the guest has booked more than once).
  Read-only.
*/

DO $$
BEGIN
    IF to_regclass('kubo.guest') IS NULL
       OR to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL THEN
        RAISE NOTICE 'Guest or reservation tables are not provisioned; skipping guest stay stats';
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
            COUNT(pr.guest_id) FILTER (
                WHERE pr.status NOT IN ('Cancelled', 'NoShow')
            ) >= 2 AS is_returning
        FROM kubo.guest AS g
        LEFT JOIN per_reservation AS pr ON pr.guest_id = g.guest_id
        WHERE g.guest_id = ANY (p_guest_ids)
        GROUP BY g.guest_id;
        $function$
    $sql$;
END $$;
