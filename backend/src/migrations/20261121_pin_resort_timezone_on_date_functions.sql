/*
  Migration: 20261121_pin_resort_timezone_on_date_functions.sql
  -------------------------------------------------------------
  Make "today" mean the resort's today inside the reservation routines.

  Stay dates and the early/late fee clock are resort time (Asia/Manila), but
  the routines compared stay dates with CURRENT_DATE, which uses the database
  session time zone (UTC on most hosts). Between 00:00 and 08:00 in Manila the
  database date is still yesterday, so a same-day arrival was refused as an
  "early check-in", and the other date guards drifted the same way.

  This sets `timezone = 'Asia/Manila'` on every routine in a kubo* schema whose
  body uses CURRENT_DATE. The setting applies only while the routine runs, so
  no function body is rewritten, no session or timestamptz data is affected,
  and routines added later that use CURRENT_DATE are picked up by re-running
  this statement in a new migration. Idempotent.
*/

DO $$
DECLARE
    v_fn record;
BEGIN
    FOR v_fn IN
        SELECT p.oid::regprocedure AS signature
        FROM pg_proc AS p
        JOIN pg_namespace AS n ON n.oid = p.pronamespace
        WHERE n.nspname LIKE 'kubo%'
          AND p.prokind = 'f'
          AND p.prosrc ILIKE '%current\_date%'
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %s SET timezone TO %L',
            v_fn.signature,
            'Asia/Manila'
        );
    END LOOP;
END $$;
