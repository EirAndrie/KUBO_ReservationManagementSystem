/**
 * Validation rules for the Administrator-managed additional-charge catalog.
 *
 * Item names and descriptions are human-readable text, not identifiers. They
 * must include at least two letters; digits are allowed only alongside letters.
 * The character sets reject underscores, emoji, and other symbols while keeping
 * common punctuation used in names and short descriptions.
 */
export const CATALOG_NAME_MAX = 100;
export const CATALOG_DESCRIPTION_MAX = 255;

/**
 * Unit-price guardrails. The hard cap matches the backend schema and the
 * `additional_charge_catalog_price_max_check` database constraint. The lower
 * confirmation threshold is a UX warning only: a value above it is still valid
 * but must be explicitly confirmed before the drawer saves it.
 */
export const CATALOG_UNIT_PRICE_MIN = 0.01;
export const CATALOG_UNIT_PRICE_CONFIRM_THRESHOLD = 10_000;
export const CATALOG_UNIT_PRICE_MAX = 800_000;

export const CATALOG_NAME_PATTERN = /^[\p{L}\p{M}0-9 '’.,&/()+%-]+$/u;
export const CATALOG_DESCRIPTION_PATTERN = /^[\p{L}\p{M}0-9\s'’"“”.,;:!?()/&+%#-]+$/u;

/** Counts Unicode letters; combining marks alone do not count. */
export function hasAtLeastTwoLetters(value: string): boolean {
  return (value.match(/\p{L}/gu) ?? []).length >= 2;
}
