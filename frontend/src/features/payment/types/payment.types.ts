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
  description: string | null;
  related_payment_id: string | null;
  related_charge_id: string | null;
  notes?: string | null;
}

/** Applied additional charge (snapshot of quantity, unit price and total). */
export interface AdditionalCharge {
  additional_charge_id: string;
  reservation_id: string;
  employee_id: string;
  employee_name?: string;
  charge_type: AdditionalChargeType | string;
  catalog_name?: string | null;
  request_id?: string | null;
  quantity: number;
  unit_amount: number;
  amount: number;
  description: string;
  charge_date: string;
}

/** Administrator-managed price list item that Staff apply to reservations. */
export interface ChargeCatalogItem {
  catalog_id: string;
  charge_type: string;
  name: string;
  description: string | null;
  unit_price: number;
  is_active: boolean;
}

export const CHARGE_REQUEST_STATUSES = ['Pending', 'Approved', 'Rejected', 'Withdrawn'] as const;
export type ChargeRequestStatus = (typeof CHARGE_REQUEST_STATUSES)[number];

/** Custom ("Other") charge requested by Staff, reviewed by an Administrator. */
export interface ChargeRequest {
  request_id: string;
  reservation_id: string;
  reference_code: string;
  guest_name: string;
  requested_by: string;
  requested_by_name: string;
  charge_type: string;
  description: string;
  quantity: number;
  proposed_unit_amount: number;
  approved_unit_amount: number | null;
  status: ChargeRequestStatus;
  reviewed_by_name: string | null;
  review_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

/** Input payload to record a new payment. The backend sets status Pending. */
export interface CreatePaymentPayload {
  reservationId: string;
  paymentAmount: number;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
}

/** Input payload to refund part or all of a completed payment. */
export interface CreateRefundPayload {
  reservationId: string;
  originalPaymentId: string;
  paymentAmount: number;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
}

/** Creates a non-cash reduction against one applied charge. */
export interface CreateChargeAdjustmentPayload {
  reservationId: string;
  chargeId: string;
  paymentAmount: number;
  description: string;
}

/** Reverses some or all of a previously recorded charge adjustment. */
export interface ReverseChargeAdjustmentPayload {
  reservationId: string;
  adjustmentPaymentId: string;
  paymentAmount: number;
  description: string;
}

/** Applies an active catalog item to a reservation. */
export interface ApplyCatalogChargePayload {
  reservationId: string;
  catalogId: string;
  quantity: number;
}

/** Submits a custom charge request for Administrator review. */
export interface CreateChargeRequestPayload {
  reservationId: string;
  description: string;
  quantity: number;
  proposedUnitAmount: number;
}

/** Filter criteria for the payment ledger query */
export interface PaymentFilterParams {
  paymentMethod?: string;
  paymentStatus?: string;
  transactionType?: string;
  reservationId?: string;
  employeeId?: string;
  createdFrom?: string;
  createdTo?: string;
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
    description: string | null;
  }>;
  accommodationTotal: number;
  chargesTotal: number;
  grossBilled: number;
  netPaid: number;
  chargeReductions: number;
  outstandingBalance: number;
  isSettled: boolean;
}
