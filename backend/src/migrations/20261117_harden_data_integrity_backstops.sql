/*
  Migration: 20261117_harden_data_integrity_backstops.sql
  -------------------------------------------------------
  Follow-up to the 20261116 data-integrity migrations (code review). The
  originals were applied on the test database and are not edited (AGENTS.md).

  1. G-01, constraint is required instead of optional.
     20261116_add_reserved_kubo_overlap_exclusion.sql skipped the constraint
     with a WARNING when btree_gist could not be created, and the runner still
     recorded the file, so the constraint was never retried. This migration
     adds reserved_kubo_no_overlap if it is missing and FAILS if btree_gist is
     unavailable. A failed migration is not recorded, so startup reports the
     problem and retries on every deploy until the extension can be created.

  2. G-15, no-op updates really leave updated_at unchanged.
     The procedures already set updated_at = clock_timestamp(), so the old
     NEW IS DISTINCT FROM OLD check always saw a change. kubo.fn_set_updated_at
     now compares the rows without updated_at: a real change gets
     clock_timestamp(); a no-op keeps the previous value, even when the caller
     set updated_at itself.

  3. G-05, the deferred check runs as the definer and is safe under concurrency.
     - SECURITY DEFINER like the other routines: deferred triggers fire at
       COMMIT, after the SECURITY DEFINER procedure has returned, so they would
       otherwise need table grants for the session role.
     - The check locks the parent reservation row (FOR NO KEY UPDATE) before
       counting assignments. Two transactions that each delete one of the last
       two assignments are serialized, so the second one sees the first one's
       delete and fails instead of both committing.
     Existing reservations are not rechecked; the triggers only fire on new
     inserts and deletes.
*/

DO $$
BEGIN
    -- 1. G-01
    IF to_regclass('kubo.reserved_kubo') IS NULL THEN
        RAISE NOTICE 'kubo.reserved_kubo is not provisioned; skipping overlap constraint check';
    ELSIF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'kubo.reserved_kubo'::regclass
          AND conname = 'reserved_kubo_no_overlap'
    ) THEN
        BEGIN
            CREATE EXTENSION IF NOT EXISTS btree_gist;
        EXCEPTION
            WHEN insufficient_privilege OR undefined_file OR feature_not_supported THEN
                RAISE EXCEPTION 'reserved_kubo_no_overlap needs the btree_gist extension, which could not be created (%). Install btree_gist as a database owner, then restart.', SQLERRM
                    USING ERRCODE = '55000';
        END;

        ALTER TABLE kubo.reserved_kubo
            ADD CONSTRAINT reserved_kubo_no_overlap
            EXCLUDE USING gist (
                kubo_id WITH =,
                daterange(check_in_date, check_out_date, '[)') WITH &&
            )
            WHERE (status IN ('Reserved', 'CheckedIn'));
    END IF;

    -- 2. G-15
    IF to_regnamespace('kubo') IS NULL THEN
        RAISE NOTICE 'Schema kubo is not provisioned; skipping updated_at trigger function';
    ELSE
        EXECUTE $sql$
            CREATE OR REPLACE FUNCTION kubo.fn_set_updated_at()
            RETURNS trigger
            LANGUAGE plpgsql
            SET search_path TO 'pg_catalog', 'pg_temp'
            AS $function$
            BEGIN
                IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
                    NEW.updated_at := clock_timestamp();
                ELSE
                    NEW.updated_at := OLD.updated_at;
                END IF;
                RETURN NEW;
            END;
            $function$
        $sql$;
    END IF;

    -- 3. G-05
    IF to_regprocedure('kubo_reservation_management.fn_assert_reservation_has_kubo()') IS NULL THEN
        RAISE NOTICE 'fn_assert_reservation_has_kubo is not provisioned; skipping';
    ELSE
        EXECUTE $sql$
            CREATE OR REPLACE FUNCTION kubo_reservation_management.fn_assert_reservation_has_kubo()
            RETURNS trigger
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path TO 'pg_catalog', 'pg_temp'
            AS $function$
            DECLARE
                v_reservation_id uuid;
            BEGIN
                IF TG_TABLE_NAME = 'reservation' THEN
                    v_reservation_id := NEW.reservation_id;
                ELSE
                    v_reservation_id := OLD.reservation_id;
                END IF;

                -- Lock the parent so concurrent deletes of its last assignments
                -- are checked one after the other. A reservation deleted in this
                -- transaction is gone, so there is nothing to check.
                PERFORM 1
                FROM kubo.reservation AS r
                WHERE r.reservation_id = v_reservation_id
                FOR NO KEY UPDATE;

                IF NOT FOUND THEN
                    RETURN NULL;
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM kubo.reserved_kubo AS rk
                    WHERE rk.reservation_id = v_reservation_id
                ) THEN
                    RAISE EXCEPTION 'A reservation must have at least one kubo assignment.'
                        USING ERRCODE = '23514';
                END IF;

                RETURN NULL;
            END;
            $function$
        $sql$;
    END IF;
END $$;
