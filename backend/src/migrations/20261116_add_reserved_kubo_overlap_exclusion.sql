/*
  Migration: 20261116_add_reserved_kubo_overlap_exclusion.sql
  -----------------------------------------------------------
  Closes gap G-01: the database itself now refuses two active assignments of the
  same kubo whose date ranges overlap (BR-031, BR-032).

  Until now only the procedures prevented double bookings. Every write path
  (fn_create_reservation, fn_add_reserved_kubo, fn_update_reserved_kubo) calls
  fn_validate_kubo_assignment, which locks the kubo row FOR UPDATE and then checks
  for overlaps, so concurrent requests are already serialized per kubo. This
  constraint is the database-level backstop for any write that bypasses those
  procedures (manual SQL, a future routine that forgets the check).

  Rules encoded:
  - Same kubo_id, overlapping [check_in_date, check_out_date) ranges. The range is
    half-open, so a check-out on day D and a new check-in on day D do not conflict.
  - Only active assignments count: status Reserved or CheckedIn. Cancelled,
    NoShow and CheckedOut assignments free the kubo, matching the overlap query in
    fn_validate_kubo_assignment. Cancel and no-show routines move every assignment
    of the reservation to Cancelled/NoShow, so the reservation-status filter in
    that query adds nothing the assignment status does not already cover.

  A violation raises SQLSTATE 23P01 (exclusion_violation). The procedures raise
  their own 23514 "Kubo is not available for the selected dates." first, so the
  API keeps its current 400 response; 23P01 is only reachable from writes that skip
  fn_validate_kubo_assignment.

  Requirements and failure behavior:
  - Needs the btree_gist extension (uuid equality inside a GiST index). It is a
    trusted extension on PostgreSQL 13+, so the database owner can create it. If it
    cannot be created, the migration logs a WARNING and skips the constraint; the
    procedures still enforce the rule.
  - If existing data already contains overlapping active assignments, the
    migration fails (and rolls back) with the conflicting kubo and reservation ids,
    so the double booking is resolved by staff instead of being silently kept.
*/

DO $$
DECLARE
    v_conflict record;
BEGIN
    IF to_regclass('kubo.reserved_kubo') IS NULL THEN
        RAISE NOTICE 'kubo.reserved_kubo is not provisioned; skipping overlap exclusion';
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'kubo.reserved_kubo'::regclass
          AND conname = 'reserved_kubo_no_overlap'
    ) THEN
        RETURN;
    END IF;

    BEGIN
        CREATE EXTENSION IF NOT EXISTS btree_gist;
    EXCEPTION
        WHEN insufficient_privilege OR undefined_file OR feature_not_supported THEN
            RAISE WARNING 'btree_gist is unavailable (%); skipping reserved_kubo_no_overlap. Procedures still prevent double bookings.', SQLERRM;
            RETURN;
    END;

    SELECT a.kubo_id,
           a.reservation_id AS first_reservation_id,
           b.reservation_id AS second_reservation_id
    INTO v_conflict
    FROM kubo.reserved_kubo AS a
    JOIN kubo.reserved_kubo AS b
      ON b.kubo_id = a.kubo_id
     AND b.reservation_id > a.reservation_id
     AND a.check_in_date < b.check_out_date
     AND a.check_out_date > b.check_in_date
    WHERE a.status IN ('Reserved', 'CheckedIn')
      AND b.status IN ('Reserved', 'CheckedIn')
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Cannot add reserved_kubo_no_overlap: kubo % is double-booked by reservations % and %. Resolve the overlap first.',
            v_conflict.kubo_id,
            v_conflict.first_reservation_id,
            v_conflict.second_reservation_id
            USING ERRCODE = '23P01';
    END IF;

    ALTER TABLE kubo.reserved_kubo
        ADD CONSTRAINT reserved_kubo_no_overlap
        EXCLUDE USING gist (
            kubo_id WITH =,
            daterange(check_in_date, check_out_date, '[)') WITH &&
        )
        WHERE (status IN ('Reserved', 'CheckedIn'));
END $$;
