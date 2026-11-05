/**
 * Public barrel export for the Check-In and Check-Out operations module.
 *
 * Direct access to internal paths (/components, /hooks, /services) from
 * outside this module is prohibited per docs/frontend-architecture.md.
 */

// Pages
export { CheckInOutPage } from './pages/check-in-out.page';

// Components
export { CheckInModal } from './components/check-in-modal.component';
export type { CheckInModalProps } from './components/check-in-modal.component';

export { CheckOutModal } from './components/check-out-modal.component';
export type { CheckOutModalProps } from './components/check-out-modal.component';

export { RecordPaymentModal } from './components/record-payment-modal.component';
export type { RecordPaymentModalProps } from './components/record-payment-modal.component';

// Hooks
export { useCheckInOutQueue, checkInOutKeys } from './hooks/use-check-in-out.hook';
export {
  useCheckInKubo,
  useApproveEarlyCheckIn,
  useCheckOutKubo,
  useRecordFinalPayment,
} from './hooks/use-check-in-out-mutations.hook';

// Services
export { checkInOutService } from './services/check-in-out.service';

// Types & DTOs
export type {
  CheckInOutActionParams,
  ArrivalRecord,
  DepartureRecord,
  RecordPaymentPayload,
} from './types/check-in-out.types';

// Constants
export {
  CHECK_IN_OUT_POLICIES,
  PAYMENT_METHOD_OPTIONS,
} from './constants/check-in-out.constants';
