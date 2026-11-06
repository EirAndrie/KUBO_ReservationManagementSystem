/**
 * Constants, limits, and policy notices for Kubo Types and Rates.
 */

export const KUBO_TYPE_LIMITS = {
  MIN_CAPACITY: 1,
  MAX_CAPACITY: 50,
  MIN_PRICE: 0,
  MAX_PRICE: 1_000_000,
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 255,
} as const;

export const CURRENCY = {
  CODE: 'PHP',
  SYMBOL: '₱',
  LOCALE: 'en-PH',
} as const;

export const KUBO_TYPE_POLICIES = {
  RATE_CHANGE_NOTICE: 'Rate changes apply to new reservations only. Existing bookings keep their rate.',
  CANNOT_DELETE_WITH_KUBOS: 'Types with kubos can’t be deleted. Move or remove those kubos first.',
} as const;
