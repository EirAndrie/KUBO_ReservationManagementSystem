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
  CreditCard: 'Credit card',
  DebitCard: 'Debit card',
  GCash: 'GCash',
  Maya: 'Maya',
  BankTransfer: 'Bank transfer',
  OnlineBanking: 'Online banking',
  Other: 'Other',
};

/** Human-readable display labels for payment types */
export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  Deposit: 'Deposit',
  PartialPayment: 'Partial payment',
  FullPayment: 'Full payment',
  BalancePayment: 'Balance payment',
  AdditionalCharge: 'Additional charge',
};

/** Human-readable display labels for transaction types */
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  Payment: 'Payment',
  Refund: 'Refund',
  Adjustment: 'Adjustment',
  Reversal: 'Reversal',
};

/** Human-readable display labels for payment statuses */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  Pending: 'Pending',
  Processing: 'Processing',
  Completed: 'Completed',
  Failed: 'Failed',
  Cancelled: 'Cancelled',
  Refunded: 'Refunded',
  PartiallyRefunded: 'Partially refunded',
};

/** Human-readable display labels for incidental charge types */
export const CHARGE_TYPE_LABELS: Record<AdditionalChargeType, string> = {
  ExtraBed: 'Extra bed',
  ExtraPerson: 'Extra guest',
  LateCheckOut: 'Late check-out',
  EarlyCheckIn: 'Early check-in',
  RoomService: 'Room service',
  FoodAndBeverage: 'Food & beverage',
  Laundry: 'Laundry',
  CleaningFee: 'Cleaning fee',
  Damage: 'Damage',
  LostKey: 'Lost key',
  LostItem: 'Lost item',
  MiniBar: 'Minibar',
  Transportation: 'Transportation',
  Other: 'Other',
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
  DERIVED_BALANCE: 'The balance is worked out from bookings, charges and payments; it is never typed in.',
  APPEND_ONLY_CHARGES: 'Charges can’t be edited after settlement. Corrections are added as new entries.',
  BALANCE_FORMULA: 'Balance due = accommodation + applied charges − (payments − refunds).',
  CURRENCY: 'Amounts are in Philippine pesos with two decimal places.',
  NO_OVERPAYMENT: 'A payment can’t be more than the balance due.',
  REFUND_LIMIT: 'Refunds can’t be more than what the guest has paid.',
  NO_HARD_DELETION: 'Payments are permanent records. Use a refund to correct one.',
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
