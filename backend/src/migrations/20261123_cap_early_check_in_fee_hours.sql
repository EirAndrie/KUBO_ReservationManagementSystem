/*
  Migration: 20261123_cap_early_check_in_fee_hours.sql
  ----------------------------------------------------
  Bounds the early check-in fee (issue #141).

  fn_time_fee_hours counted every hour between now and 12:00 on the check-in
  date, so an approved check-in weeks early billed hundreds of hours (a 2099
  stay previewed PHP 94.8M). The early fee now covers only the morning of the
  arrival day: hours from 00:00 to 12:00 on `check_in_date`, at most 12. Time
  on earlier dates is not billed as an early check-in fee.

  The late check-out branch is unchanged. The function keeps its
  SECURITY DEFINER and pinned search_path from 20261120.
*/

DO $$
BEGIN
    IF to_regnamespace('kubo_reservation_management') IS NULL
       OR to_regprocedure('kubo_reservation_management.fn_time_fee_hours(boolean,date)') IS NULL THEN
        RAISE NOTICE 'fn_time_fee_hours is not provisioned; skipping early fee cap';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_time_fee_hours(
            p_early boolean,
            p_standard_day date
        )
        RETURNS integer
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_now timestamp := clock_timestamp() AT TIME ZONE 'Asia/Manila';
            v_standard timestamp := p_standard_day + time '12:00';
            v_seconds numeric;
        BEGIN
            IF p_early THEN
                -- Only the arrival-day morning is billable: never before 00:00.
                v_seconds := extract(
                    epoch FROM (v_standard - greatest(v_now, p_standard_day::timestamp))
                );
            ELSE
                v_seconds := extract(epoch FROM (v_now - v_standard));
            END IF;

            RETURN greatest(0, ceil(v_seconds / 3600.0))::integer;
        END;
        $function$
    $sql$;
END $$;
