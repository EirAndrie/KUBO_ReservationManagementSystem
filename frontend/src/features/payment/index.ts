/**
 * Public barrel export for the Payment & Additional Charge feature module.
 *
 * Direct access to internal paths (/components, /hooks, /services) from
 * outside this module is prohibited per docs/frontend-architecture.md.
 */

// Pages
export { PaymentListPage } from './pages/payment-list.page';

// Components
export { RecordPaymentModal } from './components/record-payment-modal.component';
export type { RecordPaymentModalProps } from './components/record-payment-modal.component';

export { RefundModal } from './components/refund-modal.component';
export type { RefundModalProps } from './components/refund-modal.component';

export { AddChargeModal } from './components/add-charge-modal.component';
export type { AddChargeModalProps } from './components/add-charge-modal.component';

export { PrintInvoiceModal } from './components/print-invoice-modal.component';
export type { PrintInvoiceModalProps } from './components/print-invoice-modal.component';

export { ApproveRequestModal, RejectRequestModal } from './components/review-request-modals.component';

export { OverpaymentApprovalsSection } from './components/overpayment-approvals-section.component';
export type { OverpaymentApprovalsSectionProps } from './components/overpayment-approvals-section.component';

// Hooks
export {
  usePayments,
  useReservationPayments,
  useReservationCharges,
  useChargeCatalog,
  useChargeRequests,
  useOverpaymentApprovals,
  paymentKeys,
} from './hooks/use-payments.hook';

export {
  useRecordPayment,
  useUpdatePaymentStatus,
  useIssueRefund,
  useCreateChargeAdjustment,
  useReverseChargeAdjustment,
  useApplyCatalogCharge,
  useCreateChargeRequest,
  useDeleteCharge,
  useApproveChargeRequest,
  useRejectChargeRequest,
  useWithdrawChargeRequest,
  useCreateOverpaymentApproval,
  useRevokeOverpaymentApproval,
} from './hooks/use-payment-mutations.hook';

// Services
export { paymentService, normalizePaymentStatus } from './services/payment.service';

// Types
export type {
  Payment,
  AdditionalCharge,
  ChargeCatalogItem,
  ChargeRequest,
  ChargeRequestStatus,
  TransactionType,
  PaymentType,
  PaymentMethod,
  PaymentStatus,
  AdditionalChargeType,
  CreatePaymentPayload,
  CreateRefundPayload,
  CreateChargeAdjustmentPayload,
  ReverseChargeAdjustmentPayload,
  ApplyCatalogChargePayload,
  CreateChargeRequestPayload,
  CreateOverpaymentApprovalPayload,
  OverpaymentApproval,
  OverpaymentApprovalStatus,
  PaymentFilterParams,
  InvoiceBillingBreakdown,
} from './types/payment.types';

export {
  TRANSACTION_TYPES,
  PAYMENT_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  ADDITIONAL_CHARGE_TYPES,
  CHARGE_REQUEST_STATUSES,
} from './types/payment.types';

// Constants
export {
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  CHARGE_TYPE_LABELS,
  TRANSACTION_TYPE_COLORS,
  PAYMENT_STATUS_TAGS,
  PAYMENT_POLICIES,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  CHARGE_TYPE_OPTIONS,
} from './constants/payment.constants';
