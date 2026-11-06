/**
 * Public barrel export for the Reservation feature module.
 *
 * Direct access to internal paths (/components, /hooks, /services) from
 * outside this module is prohibited per docs/frontend-architecture.md.
 */

// Pages
export { ReservationListPage } from './pages/reservation-list.page';
export { ReservationDetailPage } from './pages/reservation-detail.page';

// Components
export { ReservationWizard } from './components/reservation-wizard.component';
export type { ReservationWizardProps } from './components/reservation-wizard.component';

export { ReservationStatusTag } from './components/reservation-status-tag.component';
export { CancelReservationModal } from './components/cancel-reservation-modal.component';
export { ReservationPickerModal } from './components/reservation-picker-modal.component';
export type { ReservationStatusTagProps } from './components/reservation-status-tag.component';

// Hooks
export {
  useReservations,
  useReservation,
  useAvailableKubos,
  useReservationPayments,
  useReservationCharges,
  reservationKeys,
} from './hooks/use-reservations.hook';

export {
  useCreateReservation,
  useUpdateReservation,
  useConfirmReservation,
  useCancelReservation,
  useMarkNoShow,
  useDeleteReservation,
} from './hooks/use-reservation-mutations.hook';

// Utils
export { stayOf, billedNights, balanceOf, isTerminal, TERMINAL_STATUSES } from './utils/reservation.utils';
export type { StaySummary } from './utils/reservation.utils';

// Services
export { reservationService } from './services/reservation.service';

// Types & DTOs
export type {
  Reservation,
  ReservationStatus,
  BookingSource,
  ReservationAssignment,
  CreateAssignmentDTO,
  CreateReservationDTO,
  UpdateReservationDTO,
  CancelReservationDTO,
  ReservationFilterParams,
  AvailableKubo,
  PaymentItem,
  AdditionalChargeItem,
} from './types/reservation.types';

export {
  RESERVATION_STATUSES,
  BOOKING_SOURCES,
} from './types/reservation.types';

// Constants
export {
  STATUS_CONFIG,
  BOOKING_SOURCE_LABELS,
  BOOKING_SOURCE_OPTIONS,
  STATUS_OPTIONS,
  RESERVATION_POLICIES,
  RESERVATION_LIMITS,
} from './constants/reservation.constants';
