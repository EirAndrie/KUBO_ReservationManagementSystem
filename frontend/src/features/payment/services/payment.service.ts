import { apiClient } from '@/lib/api';
import type {
  Payment,
  AdditionalCharge,
  CreatePaymentPayload,
  CreateRefundPayload,
  CreateAdditionalChargePayload,
  PaymentFilterParams,
  TransactionType,
  PaymentType,
  PaymentMethod,
  PaymentStatus,
  AdditionalChargeType,
} from '../types/payment.types';

// Helper to normalize backend transaction type
function normalizeTransactionType(val?: string): TransactionType {
  const lower = (val || '').toLowerCase();
  if (lower.includes('refund')) return 'Refund';
  if (lower.includes('adj')) return 'Adjustment';
  if (lower.includes('rev')) return 'Reversal';
  return 'Payment';
}

// Helper to normalize payment type
function normalizePaymentType(val?: string): PaymentType {
  const lower = (val || '').toLowerCase().replace(/[\s_-]/g, '');
  if (lower.includes('deposit')) return 'Deposit';
  if (lower.includes('partial')) return 'PartialPayment';
  if (lower.includes('full')) return 'FullPayment';
  if (lower.includes('balance')) return 'BalancePayment';
  if (lower.includes('additional') || lower.includes('charge')) return 'AdditionalCharge';
  return 'FullPayment';
}

// Helper to normalize payment method
function normalizePaymentMethod(val?: string): PaymentMethod {
  const lower = (val || '').toLowerCase().replace(/[\s_-]/g, '');
  if (lower.includes('cash')) return 'Cash';
  if (lower.includes('credit')) return 'CreditCard';
  if (lower.includes('debit')) return 'DebitCard';
  if (lower.includes('gcash')) return 'GCash';
  if (lower.includes('maya')) return 'Maya';
  if (lower.includes('bank')) return 'BankTransfer';
  if (lower.includes('online')) return 'OnlineBanking';
  return 'Other';
}

// Helper to normalize payment status
function normalizePaymentStatus(val?: string): PaymentStatus {
  const lower = (val || '').toLowerCase().replace(/[\s_-]/g, '');
  if (lower.includes('partiallyrefund')) return 'PartiallyRefunded';
  if (lower.includes('refund')) return 'Refunded';
  if (lower.includes('complete')) return 'Completed';
  if (lower.includes('process')) return 'Processing';
  if (lower.includes('fail')) return 'Failed';
  if (lower.includes('cancel')) return 'Cancelled';
  return 'Completed';
}

// Helper to normalize charge type
function normalizeChargeType(val?: string): AdditionalChargeType {
  const lower = (val || '').toLowerCase().replace(/[\s_-]/g, '');
  if (lower.includes('extrabed')) return 'ExtraBed';
  if (lower.includes('extraperson') || lower.includes('extraguest')) return 'ExtraPerson';
  if (lower.includes('latecheckout')) return 'LateCheckOut';
  if (lower.includes('earlycheckin')) return 'EarlyCheckIn';
  if (lower.includes('roomservice')) return 'RoomService';
  if (lower.includes('food') || lower.includes('beverage') || lower.includes('f&b')) return 'FoodAndBeverage';
  if (lower.includes('laundry')) return 'Laundry';
  if (lower.includes('cleaning')) return 'CleaningFee';
  if (lower.includes('damage')) return 'Damage';
  if (lower.includes('lostkey')) return 'LostKey';
  if (lower.includes('lostitem')) return 'LostItem';
  if (lower.includes('minibar')) return 'MiniBar';
  if (lower.includes('transport')) return 'Transportation';
  return 'Other';
}

function mapPaymentRecord(row: Record<string, unknown>): Payment {
  return {
    payment_id: String(row.payment_id || row.paymentId || row.id || Math.random().toString(36).slice(2)),
    reservation_id: String(row.reservation_id || row.reservationId || ''),
    employee_id: String(row.employee_id || row.employeeId || ''),
    employee_name: row.employee_name ? String(row.employee_name) : undefined,
    reservation_reference: row.reservation_reference || row.reference_code ? String(row.reservation_reference || row.reference_code) : undefined,
    guest_name: row.guest_name ? String(row.guest_name) : undefined,
    payment_amount: Number(row.payment_amount ?? row.paymentAmount ?? row.amount ?? 0),
    transaction_type: normalizeTransactionType(String(row.transaction_type || row.transactionType || 'Payment')),
    payment_type: normalizePaymentType(String(row.payment_type || row.paymentType || 'FullPayment')),
    payment_method: normalizePaymentMethod(String(row.payment_method || row.paymentMethod || 'Cash')),
    payment_status: normalizePaymentStatus(String(row.payment_status || row.paymentStatus || 'Completed')),
    payment_date: String(row.payment_date || row.paymentDate || row.created_at || new Date().toISOString()),
    notes: row.notes ? String(row.notes) : null,
  };
}

function mapChargeRecord(row: Record<string, unknown>): AdditionalCharge {
  return {
    additional_charge_id: String(row.additional_charge_id || row.additionalChargeId || row.id || Math.random().toString(36).slice(2)),
    reservation_id: String(row.reservation_id || row.resrvationId || row.reservationId || ''),
    employee_id: String(row.employee_id || row.employeeId || ''),
    employee_name: row.employee_name ? String(row.employee_name) : undefined,
    charge_type: normalizeChargeType(String(row.charge_type || row.additionalChargeType || 'Other')),
    amount: Number(row.amount ?? row.additionalChargeAmount ?? 0),
    description: String(row.description || row.additionalChargeDescription || ''),
    charge_date: String(row.charge_date || row.chargeDate || row.created_at || new Date().toISOString()),
  };
}

/**
 * Service for handling all Payment & Additional Charge API transactions.
 */
export const paymentService = {
  /**
   * Fetches payments ledger with optional status, method, reservation, and date filters.
   */
  getAll: async (params?: PaymentFilterParams): Promise<Payment[]> => {
    const queryParams: Record<string, string | number | undefined> = {};
    if (params?.paymentMethod) queryParams.paymentMethod = params.paymentMethod.toLowerCase();
    if (params?.paymentStatus) queryParams.paymentStatus = params.paymentStatus.toLowerCase();
    if (params?.reservationId) queryParams.reservationId = params.reservationId;
    if (params?.employeeId) queryParams.employeeId = params.employeeId;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.offset) queryParams.offset = params.offset;

    let res: unknown;
    try {
      res = await apiClient.get<Record<string, unknown>>('/payments', { params: queryParams });
    } catch {
      // Retain the existing alternate route while allowing its errors to reach the query state.
      res = await apiClient.get<Record<string, unknown>>('/payments/payments', { params: queryParams });
    }
    const raw = res as { payments?: Record<string, unknown>[] } | Record<string, unknown>[];
    if (Array.isArray(raw)) return raw.map(mapPaymentRecord);
    if (Array.isArray((raw as { payments?: Record<string, unknown>[] })?.payments)) {
      return (raw as { payments: Record<string, unknown>[] }).payments.map(mapPaymentRecord);
    }
    throw new Error('The server returned an invalid payment list.');
  },

  /**
   * Fetches payments belonging to a specific reservation.
   */
  getByReservation: async (reservationId: string): Promise<Payment[]> => {
    try {
      const res = await apiClient.get<Record<string, unknown>>(`/reservations/${reservationId}/payments`);
      const raw = res as unknown as { payments?: Record<string, unknown>[] } | Record<string, unknown>[];
      if (Array.isArray(raw)) return raw.map(mapPaymentRecord);
      if (Array.isArray((raw as { payments?: Record<string, unknown>[] })?.payments)) {
        return (raw as { payments: Record<string, unknown>[] }).payments.map(mapPaymentRecord);
      }
    } catch {
      const res = await apiClient.get<Record<string, unknown>>(`/payments/reservations/${reservationId}/payments`);
      const raw = res as unknown as { payments?: Record<string, unknown>[] } | Record<string, unknown>[];
      if (Array.isArray(raw)) return raw.map(mapPaymentRecord);
      if (Array.isArray((raw as { payments?: Record<string, unknown>[] })?.payments)) {
        return (raw as { payments: Record<string, unknown>[] }).payments.map(mapPaymentRecord);
      }
    }
    throw new Error('The server returned an invalid payment list.');
  },

  /**
   * Records a new incoming payment (BR-049, BR-053).
   */
  create: async (reservationId: string, payload: CreatePaymentPayload): Promise<Payment> => {
    const backendData = {
      reservationId,
      employeeId: payload.employeeId,
      paymentAmount: Number(payload.paymentAmount.toFixed(2)),
      transactionType: (payload.transactionType || 'Payment').toLowerCase() === 'refund' ? 'refund' : 'payment',
      paymentType: payload.paymentType.toLowerCase().replace(/payment/g, ''),
      paymentMethod: payload.paymentMethod.replace(/([A-Z])/g, ' $1').trim().toLowerCase(),
      paymentStatus: (payload.paymentStatus || 'Completed').toLowerCase(),
      paymentDate: payload.paymentDate || new Date().toISOString(),
      notes: payload.notes || undefined,
    };

    let res: unknown;
    try {
      res = await apiClient.post<Record<string, unknown>>(
        `/reservations/${reservationId}/payments`,
        backendData
      );
    } catch {
      res = await apiClient.post<Record<string, unknown>>(
        `/payments/reservations/${reservationId}/payments`,
        backendData
      );
    }

    const raw = res as unknown as { payments?: Record<string, unknown> } | Record<string, unknown>;
    const record = (raw as { payments?: Record<string, unknown> })?.payments || raw;
    return mapPaymentRecord(record as Record<string, unknown>);
  },

  /**
   * Issues an audited refund against a completed payment (BR-054).
   */
  refund: async (reservationId: string, payload: CreateRefundPayload): Promise<Payment> => {
    const backendData = {
      reservationId,
      employeeId: payload.employeeId,
      paymentAmount: Number(payload.paymentAmount.toFixed(2)),
      transactionType: 'refund',
      paymentType: payload.paymentType.toLowerCase().replace(/payment/g, ''),
      paymentMethod: payload.paymentMethod.replace(/([A-Z])/g, ' $1').trim().toLowerCase(),
      paymentStatus: 'completed',
      paymentDate: payload.paymentDate || new Date().toISOString(),
      notes: payload.reason,
    };

    let res: unknown;
    try {
      res = await apiClient.post<Record<string, unknown>>(
        `/reservations/${reservationId}/payments/refund`,
        backendData
      );
    } catch {
      res = await apiClient.post<Record<string, unknown>>(
        `/payments/reservations/${reservationId}/payments/refund`,
        backendData
      );
    }

    const raw = res as unknown as { payments?: Record<string, unknown> } | Record<string, unknown>;
    const record = (raw as { payments?: Record<string, unknown> })?.payments || raw;
    return mapPaymentRecord(record as Record<string, unknown>);
  },

  /**
   * Fetches incidental / additional charges for a reservation.
   */
  getChargesByReservation: async (reservationId: string): Promise<AdditionalCharge[]> => {
    try {
      const res = await apiClient.get<Record<string, unknown>>(`/reservations/${reservationId}/charges`);
      const raw = res as unknown as { additionalCharges?: Record<string, unknown>[] } | Record<string, unknown>[];
      if (Array.isArray(raw)) return raw.map(mapChargeRecord);
      if (Array.isArray((raw as { additionalCharges?: Record<string, unknown>[] })?.additionalCharges)) {
        return (raw as { additionalCharges: Record<string, unknown>[] }).additionalCharges.map(mapChargeRecord);
      }
    } catch {
      const res = await apiClient.get<Record<string, unknown>>(`/additional-charges/reservations/${reservationId}/charges`);
      const raw = res as unknown as { additionalCharges?: Record<string, unknown>[] } | Record<string, unknown>[];
      if (Array.isArray(raw)) return raw.map(mapChargeRecord);
      if (Array.isArray((raw as { additionalCharges?: Record<string, unknown>[] })?.additionalCharges)) {
        return (raw as { additionalCharges: Record<string, unknown>[] }).additionalCharges.map(mapChargeRecord);
      }
    }
    throw new Error('The server returned an invalid charge list.');
  },

  /**
   * Posts an incidental charge to a reservation (BR-042, BR-046).
   */
  createCharge: async (
    reservationId: string,
    payload: CreateAdditionalChargePayload
  ): Promise<AdditionalCharge> => {
    // Normalize charge type string e.g. "ExtraBed" -> "extra bed"
    const formattedType = payload.additionalChargeType
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toLowerCase();

    const backendData = {
      reservationId,
      resrvationId: reservationId, // Handles backend schema typo compatibility
      employeeId: payload.employeeId,
      additionalChargeType: formattedType,
      additionalChargeAmount: Number(payload.additionalChargeAmount.toFixed(2)),
      additionalChargeDescription: payload.additionalChargeDescription,
      chargeDate: payload.chargeDate || new Date().toISOString(),
    };

    let res: unknown;
    try {
      res = await apiClient.post<Record<string, unknown>>(
        `/reservations/${reservationId}/charges`,
        backendData
      );
    } catch {
      res = await apiClient.post<Record<string, unknown>>(
        `/additional-charges/reservations/${reservationId}/charges`,
        backendData
      );
    }

    const raw = res as unknown as { additionalCharges?: Record<string, unknown> } | Record<string, unknown>;
    const record = (raw as { additionalCharges?: Record<string, unknown> })?.additionalCharges || raw;
    return mapChargeRecord(record as Record<string, unknown>);
  },
};
