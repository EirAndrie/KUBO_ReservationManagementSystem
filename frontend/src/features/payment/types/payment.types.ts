/**
 * Domain types and DTO contracts for the Payment and Additional Charge modules.
 * Strictly implements Business Rules BR-040 through BR-057.
 */

export const TRANSACTION_TYPES = [
  'Payment',
  'Refund',
  'Adjustment',
  'Reversal',
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PAYMENT_TYPES = [
  'Deposit',
  'PartialPayment',
  'FullPayment',
  'BalancePayment',
  'AdditionalCharge',
] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_METHODS = [
  'Cash',
  'CreditCard',
  'DebitCard',
  'GCash',
  'Maya',
  'BankTransfer',
  'OnlineBanking',
  'Other',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  'Pending',
  'Processing',
  'Completed',
  'Failed',
  'Cancelled',
  'Refunded',
  'PartiallyRefunded',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ADDITIONAL_CHARGE_TYPES = [
  'ExtraBed',
  'ExtraPerson',
  'LateCheckOut',
  'EarlyCheckIn',
  'RoomService',
  'FoodAndBeverage',
  'Laundry',
  'CleaningFee',
  'Damage',
  'LostKey',
  'LostItem',
  'MiniBar',
  'Transportation',
  'Other',
] as const;

export type AdditionalChargeType = (typeof ADDITIONAL_CHARGE_TYPES)[number];

/** Normalized Payment record from database/API */
export interface Payment {
  payment_id: string;
  reservation_id: string;
  employee_id: string;
  employee_name?: string;
  reservation_reference?: string;
  guest_name?: string;
  payment_amount: number;
  transaction_type: TransactionType;
  payment_type: PaymentType;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_date: string;
  notes?: string | null;
}

/** Normalized Additional Charge record from database/API */
export interface AdditionalCharge {
  additional_charge_id: string;
  reservation_id: string;
  employee_id: string;
  employee_name?: string;
  charge_type: AdditionalChargeType;
  amount: number;
  description: string;
  charge_date: string;
}

/** Input payload to record a new payment transaction */
export interface CreatePaymentPayload {
  reservationId: string;
  employeeId: string;
  paymentAmount: number;
  transactionType?: TransactionType;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paymentDate?: string;
  notes?: string;
  adminOverride?: boolean;
  adminReason?: string;
}

/** Input payload to issue an audited refund */
export interface CreateRefundPayload {
  reservationId: string;
  employeeId: string;
  paymentAmount: number;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paymentDate?: string;
  reason: string;
}

/** Input payload to post an incidentals/additional charge */
export interface CreateAdditionalChargePayload {
  reservationId: string;
  employeeId: string;
  additionalChargeType: string;
  additionalChargeAmount: number;
  additionalChargeDescription: string;
  chargeDate?: string;
}

/** Filter criteria for the payment ledger query */
export interface PaymentFilterParams {
  paymentMethod?: string;
  paymentStatus?: string;
  transactionType?: string;
  reservationId?: string;
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/** Printable Guest Invoice / Statement breakdown */
export interface InvoiceBillingBreakdown {
  reservationId: string;
  referenceCode: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  assignments: Array<{
    kuboNumber: string;
    typeName: string;
    nights: number;
    pricePerNight: number;
    total: number;
  }>;
  additionalCharges: Array<{
    chargeId: string;
    chargeType: string;
    description: string;
    amount: number;
    date: string;
  }>;
  payments: Array<{
    paymentId: string;
    date: string;
    transactionType: TransactionType;
    method: string;
    type: string;
    amount: number;
    status: string;
  }>;
  accommodationTotal: number;
  chargesTotal: number;
  grossBilled: number;
  netPaid: number;
  outstandingBalance: number;
  isSettled: boolean;
}
