/**
 * Constants, limits, and policy notices for Kubo Types and Rates.
 * Enforces Zero Magic Strings and aligns with BR-016, BR-020, and BR-048.
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
  RATE_CHANGE_NOTICE:
    'Rate modifications apply strictly to new bookings. Existing reservations retain their booked rate snapshot (BR-020).',
  CANNOT_DELETE_WITH_KUBOS:
    'Kubo types referenced by existing kubos cannot be hard-deleted. Take referencing kubos Out of Service instead (BR-022).',
} as const;
