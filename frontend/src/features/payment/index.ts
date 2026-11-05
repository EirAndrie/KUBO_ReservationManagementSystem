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

export { AddChargeModal } from './components/add-charge-modal.component';
export type { AddChargeModalProps } from './components/add-charge-modal.component';

export { PrintInvoiceModal } from './components/print-invoice-modal.component';
export type { PrintInvoiceModalProps } from './components/print-invoice-modal.component';

// Hooks
export {
  usePayments,
  useReservationPayments,
  useReservationCharges,
  paymentKeys,
} from './hooks/use-payments.hook';

export {
  useRecordPayment,
  useIssueRefund,
  useAddCharge,
} from './hooks/use-payment-mutations.hook';

// Services
export { paymentService } from './services/payment.service';

// Types
export type {
  Payment,
  AdditionalCharge,
  TransactionType,
  PaymentType,
  PaymentMethod,
  PaymentStatus,
  AdditionalChargeType,
  CreatePaymentPayload,
  CreateRefundPayload,
  CreateAdditionalChargePayload,
  PaymentFilterParams,
  InvoiceBillingBreakdown,
} from './types/payment.types';

export {
  TRANSACTION_TYPES,
  PAYMENT_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  ADDITIONAL_CHARGE_TYPES,
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
