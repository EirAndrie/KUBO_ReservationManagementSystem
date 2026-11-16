/*
  Migration: 20261116_add_updated_at_triggers.sql
  -----------------------------------------------
  Closes gap G-15: updated_at is now maintained by the database instead of
  relying on every UPDATE to set it.

  Tables with an updated_at column: kubo.guest, kubo.employee and
  kubo.additional_charge_catalog. The stored procedures already set
  updated_at = clock_timestamp() on their updates; the trigger covers the rest
  (one-off data fixes such as the role merge in
  20261106_enforce_canonical_role_names.sql, or manual SQL).

  The trigger always overwrites updated_at with clock_timestamp(), so a caller
  cannot back-date it. It skips UPDATEs that change nothing, so a no-op write
  does not look like an edit. Tables that are missing (or lack the column) are
  skipped with a NOTICE.
*/

DO $$
DECLARE
    v_table text;
BEGIN
    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo.fn_set_updated_at()
        RETURNS trigger
        LANGUAGE plpgsql
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        BEGIN
            IF NEW IS DISTINCT FROM OLD THEN
                NEW.updated_at := clock_timestamp();
            END IF;
            RETURN NEW;
        END;
        $function$
    $sql$;

    FOREACH v_table IN ARRAY ARRAY['guest', 'employee', 'additional_charge_catalog'] LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'kubo'
              AND table_name = v_table
              AND column_name = 'updated_at'
        ) THEN
            RAISE NOTICE 'kubo.%.updated_at does not exist; skipping trigger', v_table;
            CONTINUE;
        END IF;

        EXECUTE format('DROP TRIGGER IF EXISTS %I ON kubo.%I', v_table || '_set_updated_at', v_table);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON kubo.%I FOR EACH ROW EXECUTE FUNCTION kubo.fn_set_updated_at()',
            v_table || '_set_updated_at',
            v_table
        );
    END LOOP;
END $$;
