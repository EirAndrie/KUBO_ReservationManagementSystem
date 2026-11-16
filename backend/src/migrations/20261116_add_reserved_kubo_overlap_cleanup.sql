/*
  Migration: 20261116_add_reserved_kubo_overlap_cleanup.sql
  ---------------------------------------------------------
  Prepares existing data for the G-01 exclusion constraint (code review of
  20261116_add_reserved_kubo_overlap_exclusion.sql).

  Ordering: the runner applies files in filename order, and this name sorts
  before 20261116_add_reserved_kubo_overlap_exclusion.sql, so on a database
  that has neither file it runs first. The exclusion migration was already
  applied on the test database and is not edited (AGENTS.md); there this file
  runs afterwards and finds nothing to do.

  Problem fixed:
  - The constraint treats every Reserved/CheckedIn assignment as booked, but
    fn_validate_kubo_assignment also requires the reservation to be Pending,
    Confirmed, or CheckedIn. An assignment left Reserved/CheckedIn under a
    Cancelled, NoShow, or CheckedOut reservation (older code or a manual fix)
    frees the kubo for the procedures but not for the constraint. Such a row
    would make the exclusion migration fail at startup when a later booking
    overlaps it, or make a later booking fail with 23P01.

  Repair (assignment status brought in line with its reservation; only rows the
  procedures already treat as inactive are changed):
  - reservation Cancelled  -> active assignments become Cancelled
  - reservation NoShow     -> active assignments become NoShow
  - reservation CheckedOut -> CheckedIn assignments become CheckedOut (the
    actual check-out time is unknown, so actual_check_out_datetime is left as
    is); Reserved assignments, which were never checked in, become NoShow.
  The repair is a data fix with no acting employee, so it writes no audit rows;
  it reports the repaired count with a NOTICE.

  Afterwards, if real double bookings remain between active reservations, the
  migration fails and lists every conflict at once (the exclusion migration
  would otherwise report only the first one per deploy).
*/

DO $$
DECLARE
    v_repaired integer;
    v_conflicts text;
BEGIN
    IF to_regclass('kubo.reserved_kubo') IS NULL
       OR to_regclass('kubo.reservation') IS NULL THEN
        RAISE NOTICE 'Reservation tables are not provisioned; skipping overlap cleanup';
        RETURN;
    END IF;

    UPDATE kubo.reserved_kubo AS rk
    SET status = CASE
            WHEN r.status = 'Cancelled' THEN 'Cancelled'
            WHEN r.status = 'NoShow' THEN 'NoShow'
            WHEN rk.status = 'CheckedIn' THEN 'CheckedOut'
            ELSE 'NoShow'
        END::kubo.reserved_kubo_status
    FROM kubo.reservation AS r
    WHERE r.reservation_id = rk.reservation_id
      AND rk.status IN ('Reserved', 'CheckedIn')
      AND r.status IN ('Cancelled', 'NoShow', 'CheckedOut');

    GET DIAGNOSTICS v_repaired = ROW_COUNT;
    IF v_repaired > 0 THEN
        RAISE NOTICE 'Repaired % active assignment(s) under inactive reservations', v_repaired;
    END IF;

    SELECT string_agg(
               format('kubo %s: reservations %s and %s', a.kubo_id, a.reservation_id, b.reservation_id),
               '; '
           )
    INTO v_conflicts
    FROM kubo.reserved_kubo AS a
    JOIN kubo.reserved_kubo AS b
      ON b.kubo_id = a.kubo_id
     AND b.reservation_id > a.reservation_id
     AND a.check_in_date < b.check_out_date
     AND a.check_out_date > b.check_in_date
    WHERE a.status IN ('Reserved', 'CheckedIn')
      AND b.status IN ('Reserved', 'CheckedIn');

    IF v_conflicts IS NOT NULL THEN
        RAISE EXCEPTION 'Double bookings must be resolved before reserved_kubo_no_overlap can be added: %', v_conflicts
            USING ERRCODE = '23P01';
    END IF;
END $$;
