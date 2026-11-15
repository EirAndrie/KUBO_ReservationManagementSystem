/*
  Migration: 20261116_validate_kubo_names.sql
  -------------------------------------------------
  Rejects kubo numbers / names that are numeric-only (e.g. 12345).
  Rule: A kubo name cannot be numeric-only and must contain at least one letter.

  The constraint is NOT VALID so existing rows are unaffected.
  It is enforced for every new INSERT and UPDATE.
*/

DO $$
BEGIN
    IF to_regclass('kubo.kubo') IS NULL THEN
        RAISE NOTICE 'kubo.kubo is not provisioned; skipping kubo name validation';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'kubo_name_not_numeric_check'
          AND conrelid = 'kubo.kubo'::regclass
    ) THEN
        ALTER TABLE kubo.kubo
            ADD CONSTRAINT kubo_name_not_numeric_check
            CHECK (
                kubo_number !~ '^[0-9]+$'
                AND kubo_number ~ '[[:alpha:]]'
            )
            NOT VALID;
    END IF;
END;
$$;
