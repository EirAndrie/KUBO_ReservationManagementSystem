/*
  Migration: 20261116_validate_employee_names.sql
  -------------------------------------------------
  Rejects employee first/last names that do not look like names. Numeric-only
  entries (for example 12345) and unsupported symbols were previously accepted
  and stored in kubo.employee.

  Rule: a name starts with a letter and may contain Unicode letters, combining
  marks, spaces, hyphens, apostrophes, and periods. Digits, emoji, and other
  symbols are rejected.

  The constraint is NOT VALID so existing rows are unaffected. It is enforced
  for every new INSERT and UPDATE.
*/

DO $$
BEGIN
    IF to_regclass('kubo.employee') IS NULL THEN
        RAISE NOTICE 'kubo.employee is not provisioned; skipping employee name validation';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'employee_name_check'
          AND conrelid = 'kubo.employee'::regclass
    ) THEN
        ALTER TABLE kubo.employee
            ADD CONSTRAINT employee_name_check
            CHECK (
                first_name ~ '^[[:alpha:]]([[:alpha:] ''’.-])*$'
                AND last_name ~ '^[[:alpha:]]([[:alpha:] ''’.-])*$'
            )
            NOT VALID;
    END IF;
END;
$$;
