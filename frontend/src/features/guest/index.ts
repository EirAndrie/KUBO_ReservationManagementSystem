/**
 * Public barrel export for the Guest feature module.
 *
 * All cross-feature consumers must import exclusively from this entrypoint.
 * Direct access to internal paths (/components, /hooks, /services) from
 * outside this module is prohibited per frontend-architecture.md.
 */

// Pages
export { GuestListPage } from './pages/guest-list.page';
export { GuestDetailPage } from './pages/guest-detail.page';

// Components
export { GuestForm } from './components/guest-form.component';
export type { GuestFormProps } from './components/guest-form.component';

export { GuestSearchSelect } from './components/guest-search-select.component';
export type { GuestSearchSelectProps } from './components/guest-search-select.component';

// Hooks
export { useGuests, useGuest, useGuestReservations, guestKeys } from './hooks/use-guests.hook';
export {
  useCreateGuest,
  useUpdateGuest,
  useDeleteGuest,
} from './hooks/use-guest-mutations.hook';

// Services
export { guestService } from './services/guest.service';

// Types & DTOs
export type {
  Guest,
  ValidIdType,
  GuestFilterParams,
  CreateGuestDTO,
  UpdateGuestDTO,
  GuestsApiResponse,
  SingleGuestApiResponse,
  GuestReservationHistoryItem,
  GuestReservationsApiResponse,
} from './types/guest.types';

export { VALID_ID_TYPES } from './types/guest.types';

// Constants
export {
  PHILIPPINE_PHONE_REGEX,
  EMAIL_REGEX,
  GUEST_LIMITS,
  ID_TYPE_OPTIONS,
  ID_TYPE_LABEL_MAP,
  GUEST_POLICIES,
} from './constants/guest.constants';
