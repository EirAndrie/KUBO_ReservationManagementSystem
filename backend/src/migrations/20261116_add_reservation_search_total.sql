/*
  Migration: 20261116_add_reservation_search_total.sql
  ----------------------------------------------------
  Adds the total match count to the reservation list search so the API can
  report it with each page.

  Problem fixed:
  - The reservation list tabs (Pending, Arriving, In-house) and other counts
    fetched up to 100 rows and used the row count, so any count above 100 was
    wrong.

  Changed: kubo_reservation_management.fn_search_reservation_ids(...)
  Same parameters, filters, sort, and page window as
  20261116_add_reservation_search_ids.sql. It now returns
  (reservation_id uuid, total_count bigint), where total_count is the number of
  reservations matching the filters before LIMIT/OFFSET (count(*) OVER ()).
  The return type changes, so the function is dropped and recreated.
*/

DO $$
BEGIN
    IF to_regclass('kubo.reservation') IS NULL
       OR to_regclass('kubo.reserved_kubo') IS NULL
       OR to_regclass('kubo.kubo') IS NULL
       OR to_regclass('kubo.kubo_type') IS NULL
       OR to_regclass('kubo.guest') IS NULL
       OR to_regclass('kubo.employee') IS NULL THEN
        RAISE NOTICE 'Reservation search dependencies are not provisioned; skipping migration';
        RETURN;
    END IF;

    DROP FUNCTION IF EXISTS kubo_reservation_management.fn_search_reservation_ids(
        kubo.reservation_status, kubo.booking_source, text, uuid, uuid,
        date, date, date, date, date, text, text, integer, integer
    );

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_search_reservation_ids(
            p_status kubo.reservation_status DEFAULT NULL,
            p_booking_source kubo.booking_source DEFAULT NULL,
            p_search text DEFAULT NULL,
            p_guest_id uuid DEFAULT NULL,
            p_employee_id uuid DEFAULT NULL,
            p_check_in_date date DEFAULT NULL,
            p_check_out_date date DEFAULT NULL,
            p_arrival_date date DEFAULT NULL,
            p_stay_from date DEFAULT NULL,
            p_stay_to date DEFAULT NULL,
            p_kubo_type_name text DEFAULT NULL,
            p_sort text DEFAULT 'booked',
            p_limit integer DEFAULT 10,
            p_offset integer DEFAULT 0
        )
        RETURNS TABLE(reservation_id uuid, total_count bigint)
        LANGUAGE plpgsql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_search text := NULLIF(
                regexp_replace(btrim(p_search), '([\\%_])', '\\\1', 'g'),
                ''
            );
            v_sort text := COALESCE(NULLIF(btrim(p_sort), ''), 'booked');
            v_type_name text := NULLIF(btrim(p_kubo_type_name), '');
        BEGIN
            IF p_check_in_date IS NOT NULL
               AND p_check_out_date IS NOT NULL
               AND p_check_out_date <= p_check_in_date THEN
                RAISE EXCEPTION 'Check-out filter must be later than check-in filter.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_stay_from IS NOT NULL
               AND p_stay_to IS NOT NULL
               AND p_stay_to < p_stay_from THEN
                RAISE EXCEPTION 'Stay-to date cannot be earlier than stay-from date.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_sort NOT IN ('booked', 'checkin') THEN
                RAISE EXCEPTION 'Sort must be booked or checkin.'
                    USING ERRCODE = '22023';
            END IF;

            RETURN QUERY
            SELECT r.reservation_id, count(*) OVER () AS total_count
            FROM kubo.reservation AS r
            JOIN kubo.guest AS g ON g.guest_id = r.guest_id
            JOIN kubo.employee AS e ON e.employee_id = r.employee_id
            WHERE (p_status IS NULL OR r.status = p_status)
              AND (p_booking_source IS NULL OR r.booking_source = p_booking_source)
              AND (p_guest_id IS NULL OR r.guest_id = p_guest_id)
              AND (p_employee_id IS NULL OR r.employee_id = p_employee_id)
              AND (
                    v_search IS NULL
                    OR r.reference_code ILIKE '%' || v_search || '%'
                    OR (g.first_name || ' ' || g.last_name) ILIKE '%' || v_search || '%'
                    OR (e.first_name || ' ' || e.last_name) ILIKE '%' || v_search || '%'
                )
              AND (
                    (p_check_in_date IS NULL AND p_check_out_date IS NULL)
                    OR EXISTS (
                        SELECT 1
                        FROM kubo.reserved_kubo AS rk
                        WHERE rk.reservation_id = r.reservation_id
                          AND (p_check_in_date IS NULL OR rk.check_in_date >= p_check_in_date)
                          AND (p_check_out_date IS NULL OR rk.check_out_date <= p_check_out_date)
                    )
                )
              AND (
                    p_arrival_date IS NULL
                    OR EXISTS (
                        SELECT 1
                        FROM kubo.reserved_kubo AS rk
                        WHERE rk.reservation_id = r.reservation_id
                          AND rk.check_in_date = p_arrival_date
                    )
                )
              AND (
                    (p_stay_from IS NULL AND p_stay_to IS NULL)
                    OR EXISTS (
                        SELECT 1
                        FROM kubo.reserved_kubo AS rk
                        WHERE rk.reservation_id = r.reservation_id
                          AND (p_stay_to IS NULL OR rk.check_in_date <= p_stay_to)
                          AND (p_stay_from IS NULL OR rk.check_out_date >= p_stay_from)
                    )
                )
              AND (
                    v_type_name IS NULL
                    OR EXISTS (
                        SELECT 1
                        FROM kubo.reserved_kubo AS rk
                        JOIN kubo.kubo AS k ON k.kubo_id = rk.kubo_id
                        JOIN kubo.kubo_type AS t ON t.kubo_type_id = k.kubo_type_id
                        WHERE rk.reservation_id = r.reservation_id
                          AND t.type_name = v_type_name
                    )
                )
            ORDER BY
                CASE
                    WHEN v_sort = 'checkin' THEN (
                        SELECT min(rk.check_in_date)
                        FROM kubo.reserved_kubo AS rk
                        WHERE rk.reservation_id = r.reservation_id
                    )
                END ASC NULLS LAST,
                r.reserved_at DESC,
                r.reservation_id
            LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100)
            OFFSET GREATEST(COALESCE(p_offset, 0), 0);
        END;
        $function$
    $sql$;
END $$;
