/**
 * Constants, limits, and policy notices for Kubo Types and Rates.
 */

export const KUBO_TYPE_LIMITS = {
  MIN_CAPACITY: 1,
  MAX_CAPACITY: 50,
  MIN_PRICE: 500,
  MAX_PRICE: 1_000_000,
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 255,
} as const;

/**
 * Kubo type names are readable labels, not identifiers. They need at least two
 * letters; digits are allowed only alongside letters, and the character set
 * rejects underscores, emoji, and other symbols.
 */
export const KUBO_TYPE_NAME_PATTERN = /^[\p{L}\p{M}0-9 '’.,&/()+%-]+$/u;

/** Counts Unicode letters; combining marks alone do not count. */
export function hasAtLeastTwoLetters(value: string): boolean {
  return (value.match(/\p{L}/gu) ?? []).length >= 2;
}

export const CURRENCY = {
  CODE: 'PHP',
  SYMBOL: '₱',
  LOCALE: 'en-PH',
} as const;

export const KUBO_TYPE_POLICIES = {
  RATE_CHANGE_NOTICE: 'Rate changes apply to new reservations only. Existing bookings keep their rate.',
  CANNOT_DELETE_WITH_KUBOS: 'Types with kubos can’t be deleted. Move or remove those kubos first.',
} as const;
