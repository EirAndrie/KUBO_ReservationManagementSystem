/**
 * On-demand entry for `React.lazy`. The reservation barrel (`index.ts`) is part
 * of the app shell's startup graph (services and types used by check-in-out),
 * so lazy-importing the barrel would pull every page into the first load. Only
 * lazy imports may use this file; everything else imports from `index.ts`.
 */
export { ReservationListPage } from './pages/reservation-list.page';
export { ReservationDetailPage } from './pages/reservation-detail.page';
export { ReservationWizard } from './components/reservation-wizard.component';
