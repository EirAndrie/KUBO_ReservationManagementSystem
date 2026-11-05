export const CHECK_IN_OUT_POLICIES = {
  PRECONDITION_CONFIRMED:
    'Only Confirmed reservations can check in. Pending or cancelled bookings must be updated first (BR-058).',
  EARLY_CHECKIN_NOTICE:
    'Check-in before the scheduled date requires explicit Early Check-In approval and will be audited (BR-059).',
  CHECKIN_EFFECTS:
    'Check-in records actual timestamp, marks the assignment as CheckedIn, and updates the kubo unit to Occupied (BR-060).',
  SETTLEMENT_REQUIRED:
    'Outstanding balance must be zero before check-out. All chargeable items must be settled (BR-064).',
  CHECKOUT_EFFECTS:
    'Check-out records departure timestamp, marks assignment as CheckedOut, and changes kubo unit to Cleaning (BR-063).',
  MULTI_KUBO_SUPPORT:
    'Multi-kubo stays support per-assignment check-in and check-out independently (BR-065).',
} as const;

export const PAYMENT_METHOD_OPTIONS = [
  { label: 'Cash', value: 'cash' },
  { label: 'GCash', value: 'gcash' },
  { label: 'Maya', value: 'maya' },
  { label: 'Credit Card', value: 'credit card' },
  { label: 'Debit Card', value: 'debit card' },
  { label: 'Bank Transfer', value: 'bank transfer' },
  { label: 'Online Banking', value: 'online banking' },
] as const;
