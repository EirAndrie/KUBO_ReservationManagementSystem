/*
  Migration: 20261116_validate_catalog_price.sql
  -------------------------------------------------
  Catalog items must have a positive default unit price. Zero-priced items were
  previously accepted by the table's `unit_price >= 0` check, the Zod schema,
  and the Add/Edit drawer.

  The new constraint is NOT VALID so existing zero-priced rows are left
  untouched. Every new insert or update must use a price greater than zero; a
  legacy zero-priced row must be corrected on its next save. The API also
  validates this in Zod and the drawer shows the field-level message.
*/

DO $$
BEGIN
    IF to_regclass('kubo.additional_charge_catalog') IS NULL THEN
        RAISE NOTICE 'kubo.additional_charge_catalog is not provisioned; skipping catalog price validation';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'additional_charge_catalog_price_check'
          AND conrelid = 'kubo.additional_charge_catalog'::regclass
    ) THEN
        ALTER TABLE kubo.additional_charge_catalog
            ADD CONSTRAINT additional_charge_catalog_price_check
            CHECK (unit_price > 0)
            NOT VALID;
    END IF;
END;
$$;
