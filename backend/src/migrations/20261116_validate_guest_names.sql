/*
  Migration: 20261116_validate_guest_names.sql
  -------------------------------------------------
  Rejects guest first/last names that do not look like names. Numeric-only
  entries (for example 234225) and unsupported symbols were previously accepted
  by every layer and stored in kubo.guest.

  Rule: a name starts with a letter and may contain Unicode letters, combining
  marks, spaces, hyphens, apostrophes, and periods. Digits, emoji, and other
  symbols are rejected. The application applies the same rule earlier in Zod
  and in the guest form; this constraint is the database backstop.

  The constraint is NOT VALID so existing rows with legacy values are left
  untouched. It is enforced for every new INSERT and UPDATE; an existing invalid
  row must have both names corrected on its next save.
*/

DO $$
BEGIN
    IF to_regclass('kubo.guest') IS NULL THEN
        RAISE NOTICE 'kubo.guest is not provisioned; skipping guest name validation';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'guest_name_check'
          AND conrelid = 'kubo.guest'::regclass
    ) THEN
        ALTER TABLE kubo.guest
            ADD CONSTRAINT guest_name_check
            CHECK (
                first_name ~ '^[[:alpha:]]([[:alpha:] ''’.-])*$'
                AND last_name ~ '^[[:alpha:]]([[:alpha:] ''’.-])*$'
            )
            NOT VALID;
    END IF;
END;
$$;
