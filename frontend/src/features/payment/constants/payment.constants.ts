import type {
  TransactionType,
  PaymentType,
  PaymentMethod,
  PaymentStatus,
  AdditionalChargeType,
} from '../types/payment.types';

/** Human-readable display labels for payment methods */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  Cash: 'Cash',
  CreditCard: 'Credit Card',
  DebitCard: 'Debit Card',
  GCash: 'GCash',
  Maya: 'Maya',
  BankTransfer: 'Bank Transfer',
  OnlineBanking: 'Online Banking',
  Other: 'Other',
};

/** Human-readable display labels for payment types */
export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  Deposit: 'Initial Deposit',
  PartialPayment: 'Partial Payment',
  FullPayment: 'Full Settlement',
  BalancePayment: 'Balance Payment',
  AdditionalCharge: 'Incidental / Add-on Payment',
};

/** Human-readable display labels for transaction types */
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  Payment: 'Incoming Payment',
  Refund: 'Customer Refund',
  Adjustment: 'Account Adjustment',
  Reversal: 'Payment Reversal',
};

/** Human-readable display labels for payment statuses */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  Pending: 'Pending',
  Processing: 'Processing',
  Completed: 'Completed',
  Failed: 'Failed',
  Cancelled: 'Cancelled',
  Refunded: 'Refunded',
  PartiallyRefunded: 'Partially Refunded',
};

/** Human-readable display labels for incidental charge types */
export const CHARGE_TYPE_LABELS: Record<AdditionalChargeType, string> = {
  ExtraBed: 'Extra Bed Mattress',
  ExtraPerson: 'Extra Guest / Headcount Fee',
  LateCheckOut: 'Late Check-out Fee',
  EarlyCheckIn: 'Early Check-in Surcharge',
  RoomService: 'Room Service & Delivery',
  FoodAndBeverage: 'Food & Beverage (F&B)',
  Laundry: 'Laundry Services',
  CleaningFee: 'Special Cleaning Fee',
  Damage: 'Property Damage Replacement',
  LostKey: 'Lost Key Replacement',
  LostItem: 'Lost Item / Amenity Fee',
  MiniBar: 'Mini-Bar Consumption',
  Transportation: 'Resort Shuttle / Transfer',
  Other: 'Other Incidental Charge',
};

/** Token by Intent: semantic color tags for transaction types */
export const TRANSACTION_TYPE_COLORS: Record<TransactionType, { color: string; border: string; bg: string }> = {
  Payment: { color: '#16a34a', border: '#bbf7d0', bg: '#f0fdf4' }, // Affirmative green
  Refund: { color: '#dc2626', border: '#fecaca', bg: '#fef2f2' },  // Destructive / Warning Red
  Adjustment: { color: '#d97706', border: '#fde68a', bg: '#fffbeb' }, // Caution Amber
  Reversal: { color: '#9333ea', border: '#e9d5ff', bg: '#faf5ff' },   // Purple
};

/** Token by Intent: semantic tags for payment statuses */
export const PAYMENT_STATUS_TAGS: Record<PaymentStatus, { color: string }> = {
  Completed: { color: 'success' },
  Pending: { color: 'warning' },
  Processing: { color: 'processing' },
  Failed: { color: 'error' },
  Cancelled: { color: 'default' },
  Refunded: { color: 'purple' },
  PartiallyRefunded: { color: 'cyan' },
};

/** Business Rule Policies for Payment & Billing */
export const PAYMENT_POLICIES = {
  NO_STORED_BALANCE:
    'BR-040: Database does not store balance or total columns. Balances are aggregated dynamically on the frontend.',
  APPEND_ONLY_CHARGES:
    'BR-046: Settled charges are append-only. Corrections must be made via supplementary charges or audited adjustments.',
  BALANCE_EQUATION:
    'BR-047: Outstanding Balance = Gross Billed (Accommodations + Incidentals) − Net Paid (Payments − Refunds).',
  CURRENCY_PRECISION:
    'BR-048: All monetary amounts are formatted in Philippine Pesos (₱) with strictly up to two decimal places.',
  OVERPAYMENT_RESTRICTION:
    'BR-053: A payment cannot exceed the current outstanding balance without explicit Administrator authorization.',
  AUDITED_REFUND:
    'BR-054: Refunds must be audited and must not exceed net completed payments for the reservation.',
  NO_HARD_DELETION:
    'BR-057: Financial records are strictly immutable and append-only. Routine deletions are prohibited.',
} as const;

/** Select dropdown options */
export const PAYMENT_METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const PAYMENT_TYPE_OPTIONS = Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const TRANSACTION_TYPE_OPTIONS = Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const CHARGE_TYPE_OPTIONS = Object.entries(CHARGE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));
