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

export const CATALOG_NAME_PATTERN = /^[\p{L}\p{M}0-9 '’.,&/()+%-]+$/u;
export const CATALOG_DESCRIPTION_PATTERN = /^[\p{L}\p{M}0-9\s'’"“”.,;:!?()/&+%#-]+$/u;

/** Counts Unicode letters; combining marks alone do not count. */
export function hasAtLeastTwoLetters(value: string): boolean {
  return (value.match(/\p{L}/gu) ?? []).length >= 2;
}
