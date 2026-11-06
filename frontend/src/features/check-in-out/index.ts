/**
 * Public barrel export for the Check-In and Check-Out operations module.
 *
 * Direct access to internal paths (/components, /hooks, /services) from
 * outside this module is prohibited per docs/frontend-architecture.md.
 */

// Pages
export { CheckInOutPage } from './pages/check-in-out.page';

// Components
export { CheckInDrawer } from './components/check-in-drawer.component';
export { FrontDeskQueue } from './components/front-desk-queue.component';
export type { QueueTab, FrontDeskQueueProps } from './components/front-desk-queue.component';
export type { CheckInDrawerProps } from './components/check-in-drawer.component';
export { isKuboReady, READY_KUBO_STATUSES } from './utils/kubo-readiness';

// Hooks
export { useCheckInOutQueue, checkInOutKeys } from './hooks/use-check-in-out.hook';
export {
  useCheckInKubo,
  useApproveEarlyCheckIn,
  useCheckOutKubo,
} from './hooks/use-check-in-out-mutations.hook';

// Services
export { checkInOutService } from './services/check-in-out.service';

// Types & DTOs
export type {
  CheckInOutActionParams,
  ArrivalRecord,
  DepartureRecord,
  InHouseRecord,
} from './types/check-in-out.types';

// Constants

