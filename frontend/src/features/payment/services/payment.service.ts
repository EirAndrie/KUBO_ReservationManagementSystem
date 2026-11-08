import { apiClient } from '@/lib/api';
import type {
  Payment,
  AdditionalCharge,
  ChargeCatalogItem,
  ChargeRequest,
  ChargeRequestStatus,
  CreatePaymentPayload,
  CreateRefundPayload,
  CreateChargeAdjustmentPayload,
  ReverseChargeAdjustmentPayload,
  ApplyCatalogChargePayload,
  CreateChargeRequestPayload,
  PaymentFilterParams,
  TransactionType,
  PaymentType,
  PaymentMethod,
  PaymentStatus,
} from '../types/payment.types';
import {
  TRANSACTION_TYPES,
  PAYMENT_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from '../types/payment.types';

type Row = Record<string, unknown>;

/**
 * Accepts the backend's exact enum value; tolerates case/spacing differences
 * by comparing a normalized form, and otherwise keeps the raw value so an
 * unknown status is never silently shown as something else.
 */
function matchEnum<T extends string>(values: readonly T[], raw: unknown, fallback: T): T {
  const text = String(raw ?? '').trim();
  if (!text) return fallback;
  const key = text.toLowerCase().replace(/[\s_-]/g, '');
  return values.find((v) => v.toLowerCase() === key) ?? (text as T);
}

/** BUG-03: `pending` maps to Pending; unknown values are kept, never turned into Completed. */
export function normalizePaymentStatus(val: unknown): PaymentStatus {
  return matchEnum(PAYMENT_STATUSES, val, 'Pending');
}

function mapPaymentRecord(row: Row): Payment {
  return {
    payment_id: String(row.payment_id ?? row.paymentId ?? ''),
    reservation_id: String(row.reservation_id ?? row.reservationId ?? ''),
    employee_id: String(row.employee_id ?? row.employeeId ?? ''),
    employee_name: (row.recorded_by ?? row.employee_name) ? String(row.recorded_by ?? row.employee_name) : undefined,
    reservation_reference: (row.reference_code ?? row.reservation_reference)
      ? String(row.reference_code ?? row.reservation_reference)
      : undefined,
    guest_name: row.guest_name ? String(row.guest_name) : undefined,
    payment_amount: Number(row.payment_amount ?? row.amount ?? 0),
    transaction_type: matchEnum<TransactionType>(TRANSACTION_TYPES, row.transaction_type, 'Payment'),
    payment_type: matchEnum<PaymentType>(PAYMENT_TYPES, row.payment_type, 'FullPayment'),
    payment_method: matchEnum<PaymentMethod>(PAYMENT_METHODS, row.payment_method, 'Other'),
    payment_status: normalizePaymentStatus(row.payment_status),
    payment_date: String(row.payment_date ?? row.created_at ?? ''),
    description: row.description ? String(row.description) : null,
    related_payment_id: row.related_payment_id ? String(row.related_payment_id) : null,
    related_charge_id: row.related_charge_id ? String(row.related_charge_id) : null,
    notes: row.description ? String(row.description) : row.notes ? String(row.notes) : null,
  };
}

function mapChargeRecord(row: Row): AdditionalCharge {
  return {
    additional_charge_id: String(row.charge_id ?? row.additional_charge_id ?? ''),
    reservation_id: String(row.reservation_id ?? ''),
    employee_id: String(row.employee_id ?? ''),
    employee_name: row.recorded_by ? String(row.recorded_by) : undefined,
    charge_type: String(row.charge_type ?? 'Other'),
    catalog_name: row.catalog_name ? String(row.catalog_name) : null,
    request_id: row.request_id ? String(row.request_id) : null,
    quantity: Number(row.quantity ?? 1),
    unit_amount: Number(row.unit_amount ?? row.amount ?? 0),
    amount: Number(row.amount ?? 0),
    description: String(row.description ?? ''),
    charge_date: String(row.charge_date ?? row.created_at ?? ''),
  };
}

function mapCatalogRecord(row: Row): ChargeCatalogItem {
  return {
    catalog_id: String(row.catalog_id ?? ''),
    charge_type: String(row.charge_type ?? 'Other'),
    name: String(row.name ?? ''),
    description: row.description ? String(row.description) : null,
    unit_price: Number(row.unit_price ?? 0),
    is_active: Boolean(row.is_active),
  };
}

function mapRequestRecord(row: Row): ChargeRequest {
  return {
    request_id: String(row.request_id ?? ''),
    reservation_id: String(row.reservation_id ?? ''),
    reference_code: String(row.reference_code ?? ''),
    guest_name: String(row.guest_name ?? ''),
    requested_by: String(row.requested_by ?? ''),
    requested_by_name: String(row.requested_by_name ?? ''),
    charge_type: String(row.charge_type ?? 'Other'),
    description: String(row.description ?? ''),
    quantity: Number(row.quantity ?? 1),
    proposed_unit_amount: Number(row.proposed_unit_amount ?? 0),
    approved_unit_amount: row.approved_unit_amount == null ? null : Number(row.approved_unit_amount),
    status: String(row.status ?? 'Pending') as ChargeRequestStatus,
    reviewed_by_name: row.reviewed_by_name ? String(row.reviewed_by_name) : null,
    review_reason: row.review_reason ? String(row.review_reason) : null,
    created_at: String(row.created_at ?? ''),
    reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
  };
}

function listOf(res: unknown, key: string): Row[] {
  if (Array.isArray(res)) return res as Row[];
  const value = (res as Record<string, unknown> | null)?.[key];
  if (Array.isArray(value)) return value as Row[];
  throw new Error('The server returned an unexpected response.');
}

function oneOf(res: unknown, key: string): Row {
  const value = (res as Record<string, unknown> | null)?.[key];
  return (value && typeof value === 'object' ? value : res) as Row;
}

/**
 * Payments, additional charges and charge requests. Enum values are sent
 * exactly as the backend defines them (e.g. `CreditCard`, `FullPayment`).
 * The acting employee always comes from the access token, never the body.
 */
export const paymentService = {
  /** Payments ledger with optional reservation, status, method, type and date filters. */
  getAll: async (params?: PaymentFilterParams): Promise<Payment[]> => {
    const query: Record<string, string | number> = {};
    if (params?.reservationId) query.reservationId = params.reservationId;
    if (params?.employeeId) query.employeeId = params.employeeId;
    if (params?.paymentStatus) query.paymentStatus = params.paymentStatus;
    if (params?.paymentMethod) query.paymentMethod = params.paymentMethod;
    if (params?.transactionType) query.transactionType = params.transactionType;
    if (params?.createdFrom) query.createdFrom = params.createdFrom;
    if (params?.createdTo) query.createdTo = params.createdTo;
    query.limit = params?.limit ?? 100;
    if (params?.offset) query.offset = params.offset;
    const res = await apiClient.get('/payments', { params: query });
    return listOf(res, 'payments').map(mapPaymentRecord);
  },

  getByReservation: async (reservationId: string): Promise<Payment[]> => {
    const res = await apiClient.get(`/reservations/${reservationId}/payments`);
    return listOf(res, 'payments').map(mapPaymentRecord);
  },

  /** Records a payment. The server creates it as Pending; it counts once Completed. */
  create: async (payload: CreatePaymentPayload): Promise<Payment> => {
    const res = await apiClient.post(`/reservations/${payload.reservationId}/payments`, {
      paymentAmount: Number(payload.paymentAmount.toFixed(2)),
      paymentType: payload.paymentType,
      paymentMethod: payload.paymentMethod,
    });
    return mapPaymentRecord(oneOf(res, 'payments'));
  },

  /** Moves a payment along Pending → Processing → Completed / Failed / Cancelled. */
  updateStatus: async (paymentId: string, status: PaymentStatus): Promise<Payment> => {
    const res = await apiClient.patch(`/payments/${paymentId}/status`, { status });
    return mapPaymentRecord(oneOf(res, 'payments'));
  },

  /** Refunds part or all of a completed payment; cannot exceed net paid. */
  refund: async (payload: CreateRefundPayload): Promise<Payment> => {
    const res = await apiClient.post(`/reservations/${payload.reservationId}/payments/refund`, {
      originalPaymentId: payload.originalPaymentId,
      paymentAmount: Number(payload.paymentAmount.toFixed(2)),
      paymentType: payload.paymentType,
      paymentMethod: payload.paymentMethod,
    });
    return mapPaymentRecord(oneOf(res, 'payments'));
  },

  /** Records an audited Administrator credit linked to an applied charge. */
  adjustCharge: async (payload: CreateChargeAdjustmentPayload): Promise<Payment> => {
    const res = await apiClient.post(`/reservations/${payload.reservationId}/payments/adjustments`, {
      chargeId: payload.chargeId,
      paymentAmount: Number(payload.paymentAmount.toFixed(2)),
      description: payload.description,
    });
    return mapPaymentRecord(oneOf(res, 'payments'));
  },

  /** Reverses a previous charge Adjustment; this does not issue a cash refund. */
  reverseChargeAdjustment: async (payload: ReverseChargeAdjustmentPayload): Promise<Payment> => {
    const res = await apiClient.post(
      `/reservations/${payload.reservationId}/payments/adjustments/${payload.adjustmentPaymentId}/reversals`,
      {
        paymentAmount: Number(payload.paymentAmount.toFixed(2)),
        description: payload.description,
      },
    );
    return mapPaymentRecord(oneOf(res, 'payments'));
  },

  /** Applied charges for a reservation (pending requests are not included). */
  getChargesByReservation: async (reservationId: string): Promise<AdditionalCharge[]> => {
    const res = await apiClient.get(`/reservations/${reservationId}/charges`);
    return listOf(res, 'additionalCharges').map(mapChargeRecord);
  },

  applyCatalogCharge: async (payload: ApplyCatalogChargePayload): Promise<AdditionalCharge> => {
    const res = await apiClient.post(`/reservations/${payload.reservationId}/charges`, {
      catalogId: payload.catalogId,
      quantity: payload.quantity,
    });
    return mapChargeRecord(oneOf(res, 'additionalCharges'));
  },

  /** Deletes an applied charge; the backend blocks this after settlement. */
  deleteCharge: async (chargeId: string): Promise<void> => {
    await apiClient.delete(`/additional-charges/${chargeId}`);
  },

  getCatalog: async (): Promise<ChargeCatalogItem[]> => {
    const res = await apiClient.get('/additional-charge-catalog', { params: { limit: 100 } });
    return listOf(res, 'additionalChargeCatalog').map(mapCatalogRecord);
  },

  getChargeRequests: async (params?: { status?: ChargeRequestStatus; reservationId?: string }): Promise<ChargeRequest[]> => {
    const res = await apiClient.get('/additional-charge-requests', { params });
    return listOf(res, 'additionalChargeRequests').map(mapRequestRecord);
  },

  createChargeRequest: async (payload: CreateChargeRequestPayload): Promise<ChargeRequest> => {
    const res = await apiClient.post(`/reservations/${payload.reservationId}/charge-requests`, {
      description: payload.description,
      quantity: payload.quantity,
      proposedUnitAmount: Number(payload.proposedUnitAmount.toFixed(2)),
    });
    return mapRequestRecord(oneOf(res, 'additionalChargeRequests'));
  },

  approveChargeRequest: async (requestId: string, body: { approvedUnitAmount?: number; reason?: string }) => {
    await apiClient.patch(`/additional-charge-requests/${requestId}/approve`, body);
  },

  rejectChargeRequest: async (requestId: string, reason: string) => {
    await apiClient.patch(`/additional-charge-requests/${requestId}/reject`, { reason });
  },

  withdrawChargeRequest: async (requestId: string) => {
    await apiClient.patch(`/additional-charge-requests/${requestId}/withdraw`);
  },
};
