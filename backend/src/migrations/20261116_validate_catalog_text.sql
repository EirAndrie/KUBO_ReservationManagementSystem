/*
  Migration: 20261116_validate_catalog_text.sql
  -------------------------------------------------
  Rejects numeric-only, identifier-like, and symbol-only text in the managed
  additional-charge catalog. Item names and descriptions are labels for Staff,
  so they must contain readable letters, not standalone numbers or raw codes.

  Rule:
  - Item name: at least two letters; only letters, digits, spaces, and common
    punctuation (apostrophe, period, comma, ampersand, slash, parentheses,
    plus, percent, hyphen). Underscores, emoji, and other symbols are rejected.
  - Description: optional; when present, at least two letters and only letters,
    digits, whitespace/newlines, and standard punctuation.

  Both constraints are NOT VALID so existing rows are left untouched. They are
  enforced for every new INSERT and UPDATE; a legacy invalid row must have its
  text corrected on its next save. The API also validates these rules in Zod
  and the catalog drawer so users see field-level messages.
*/

DO $$
BEGIN
    IF to_regclass('kubo.additional_charge_catalog') IS NULL THEN
        RAISE NOTICE 'kubo.additional_charge_catalog is not provisioned; skipping catalog text validation';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'additional_charge_catalog_name_check'
          AND conrelid = 'kubo.additional_charge_catalog'::regclass
    ) THEN
        ALTER TABLE kubo.additional_charge_catalog
            ADD CONSTRAINT additional_charge_catalog_name_check
            CHECK (
                length(btrim(name)) >= 1
                AND name ~ '^[[:alpha:]0-9 ''’.,&/()+%-]+$'
                AND length(regexp_replace(name, '[^[:alpha:]]', '', 'g')) >= 2
            )
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'additional_charge_catalog_description_check'
          AND conrelid = 'kubo.additional_charge_catalog'::regclass
    ) THEN
        ALTER TABLE kubo.additional_charge_catalog
            ADD CONSTRAINT additional_charge_catalog_description_check
            CHECK (
                description IS NULL
                OR (
                    description ~ '^[[:alpha:]0-9[:space:]''’"“”.,;:!?()/&+%#-]+$'
                    AND length(regexp_replace(description, '[^[:alpha:]]', '', 'g')) >= 2
                )
            )
            NOT VALID;
    END IF;
END;
$$;
