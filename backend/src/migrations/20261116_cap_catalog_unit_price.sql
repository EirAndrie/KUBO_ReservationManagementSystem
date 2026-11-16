/*
  Migration: 20261116_cap_catalog_unit_price.sql
  -------------------------------------------------
  Catalog items feed every applied additional charge, so an unrealistic default
  unit price can produce an astronomical guest bill. The Zod schemas and the
  Add/Edit drawer enforce a hard cap of ₱800,000.00; this constraint is the
  database backstop for any path that bypasses the API.

  The constraint is NOT VALID so existing rows above the cap are left untouched
  and do not block startup. Every new insert or update must satisfy the cap; a
  legacy over-cap row must be corrected by an Administrator on its next save.
  The column is numeric(10,2), whose storage maximum is 99,999,999.99, so the
  cap also keeps values away from a numeric-overflow error.
*/

DO $$
BEGIN
    IF to_regclass('kubo.additional_charge_catalog') IS NULL THEN
        RAISE NOTICE 'kubo.additional_charge_catalog is not provisioned; skipping catalog price cap';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'additional_charge_catalog_price_max_check'
          AND conrelid = 'kubo.additional_charge_catalog'::regclass
    ) THEN
        ALTER TABLE kubo.additional_charge_catalog
            ADD CONSTRAINT additional_charge_catalog_price_max_check
            CHECK (unit_price <= 800000.00)
            NOT VALID;
    END IF;
END;
$$;
